import { CommandRunner, SubCommand } from 'nest-commander';
import fs from 'fs';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { MikroORM } from '@mikro-orm/core';
import { Inject } from '@nestjs/common';
import { getMapperToken } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { DbSeedService } from './domain/db-seed.service.js';
import { PersonFile } from './file/person-file.js';
import { RolleEntity } from '../../modules/rolle/entity/rolle.entity.js';
import { OrganisationFile } from './file/organisation-file.js';
import { DataProviderEntity } from '../../persistence/data-provider.entity.js';
import { DataProviderFile } from './file/data-provider-file.js';
import { createHash, Hash } from 'crypto';
import { DbSeed } from './domain/db-seed.js';
import { DbSeedStatus } from './repo/db-seed.entity.js';
import { DbSeedRepo } from './repo/db-seed.repo.js';

export interface SeedFile {
    entityName: string;
}

export interface EntityFile<T> extends SeedFile {
    entities: T[];
}

export type Entity = DataProviderFile | PersonFile | OrganisationFile | RolleEntity;

export type ConstructorCall = () => Entity;

@SubCommand({ name: 'seed', description: 'creates seed data in the database' })
export class DbSeedConsole extends CommandRunner {
    public constructor(
        private readonly orm: MikroORM,
        private readonly logger: ClassLogger,
        private readonly dbSeedService: DbSeedService,
        private readonly dbSeedRepo: DbSeedRepo,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {
        super();
    }

    private generateHashForEntityFile(entityFileContent: string): string {
        const hash: Hash = createHash('sha256').setEncoding('hex');
        hash.write(entityFileContent);
        hash.end();
        return hash.read() as string;
    }

    private getDirectory(_passedParams: string[]): string {
        if (_passedParams[0] !== undefined) {
            return _passedParams[0];
        }
        throw new Error('No directory provided!');
    }

    public override async run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
        const directory: string = this.getDirectory(_passedParams);
        const subDirs: string[] = this.dbSeedService.getDirectories(directory);
        this.logger.info('Found following sub-directories:');
        subDirs.forEach((sd: string) => this.logger.info(sd));

        this.logger.info('Create seed data in the database...');

        for (const subDir of subDirs) {
            const entityFileNames: string[] = this.dbSeedService.getEntityFileNames(directory, subDir);
            if (entityFileNames.length == 0) {
                this.logger.error(`No seeding data in the directory ${directory}!`);
                throw new Error('No seeding data in the directory');
            }
            this.logger.info(`Following files from ${subDir} will be processed:`);
            entityFileNames.forEach((n: string) => this.logger.info(n));
            try {
                /* eslint-disable no-await-in-loop */
                for (const entityFileName of entityFileNames) {
                    await this.readAndProcessEntityFile(directory, subDir, entityFileName);
                }
                await this.orm.em.flush();
                this.logger.info(`Created seed data from ${subDir} successfully.`);
                /* eslint-disable no-await-in-loop */
            } catch (err) {
                this.logger.error('Seed data could not be created!');
                this.logger.error(String(err));
                throw err;
            }
        }
    }

    private async readAndProcessEntityFile(directory: string, subDir: string, entityFileName: string): Promise<void> {
        const fileContentAsStr: string = fs.readFileSync(`./seeding/${directory}/${subDir}/${entityFileName}`, 'utf-8');
        const contentHash: string = this.generateHashForEntityFile(fileContentAsStr);
        const dbSeedE: Option<DbSeed<true>> = await this.dbSeedRepo.findById(contentHash);
        if (dbSeedE) {
            if (dbSeedE.status === DbSeedStatus.FAILED) {
                this.logger.warning(
                    `Skipping file ${entityFileName} because previous execution failed on ${dbSeedE.executedAt.toLocaleString()}`,
                );
            } else if (dbSeedE.status === DbSeedStatus.DONE) {
                this.logger.info(
                    `Skipping file ${entityFileName} because it was successfully executed on ${dbSeedE.executedAt.toLocaleString()}`,
                );
            }
        } else {
            const dbSeed: DbSeed<false> = DbSeed.createNew(
                contentHash,
                DbSeedStatus.STARTED,
                subDir + '/' + entityFileName,
            );
            const persistedDbSeed: DbSeed<true> = await this.dbSeedRepo.create(dbSeed);
            try {
                await this.processEntityFile(entityFileName, directory, subDir);
                persistedDbSeed.setDone();
                await this.dbSeedRepo.update(persistedDbSeed);
            } catch (err) {
                persistedDbSeed.setFailed();
                this.dbSeedRepo.forkEntityManager();
                await this.dbSeedRepo.update(persistedDbSeed);
                throw err;
            }
        }
    }

    private async processEntityFile(entityFileName: string, directory: string, subDir: string): Promise<void> {
        this.logger.info(`Processing file ${directory}/${subDir}/${entityFileName}`);
        const fileContentAsStr: string = fs.readFileSync(`./seeding/${directory}/${subDir}/${entityFileName}`, 'utf-8');
        const seedFile: SeedFile = JSON.parse(fileContentAsStr) as SeedFile;
        this.logger.info(`Processing ${seedFile.entityName} from ${directory}/${subDir}/${entityFileName}`);
        switch (seedFile.entityName) {
            case 'DataProvider':
                this.handleDataProvider(this.dbSeedService.readDataProvider(fileContentAsStr), seedFile.entityName);
                break;
            case 'Organisation':
                await this.dbSeedService.seedOrganisation(fileContentAsStr);
                break;
            case 'Person':
                await this.dbSeedService.seedPerson(fileContentAsStr);
                break;
            case 'Rolle':
                await this.dbSeedService.seedRolle(fileContentAsStr);
                break;
            case 'ServiceProvider':
                await this.dbSeedService.seedServiceProvider(fileContentAsStr);
                break;
            case 'Personenkontext':
                await this.dbSeedService.seedPersonenkontext(fileContentAsStr);
                break;
            case 'TechnicalUser':
                await this.dbSeedService.seedTechnicalUser(fileContentAsStr);
                break;
            default:
                throw new Error(`Unsupported EntityName / EntityType: ${seedFile.entityName}`);
        }
    }

    private handleDataProvider(entities: Entity[], entityName: string): void {
        for (const entity of entities) {
            const mappedEntity: DataProviderEntity = this.mapper.map(entity, DataProviderFile, DataProviderEntity);
            this.orm.em.persist(mappedEntity);
        }
        this.logger.info(`Insert ${entities.length} entities of type ${entityName}`);
    }
}
