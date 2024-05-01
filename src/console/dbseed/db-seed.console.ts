import { CommandRunner, SubCommand } from 'nest-commander';
import fs from 'fs';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { MikroORM } from '@mikro-orm/core';
import { Inject } from '@nestjs/common';
import { getMapperToken } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { DbSeedService } from './db-seed.service.js';
import { PersonFile } from './file/person-file.js';
import { RolleEntity } from '../../modules/rolle/entity/rolle.entity.js';
import { OrganisationFile } from './file/organisation-file.js';
import { DataProviderEntity } from '../../persistence/data-provider.entity.js';
import { DataProviderFile } from './file/data-provider-file.js';
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
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {
        super();
    }

    private getDirectory(_passedParams: string[]): string {
        if (_passedParams[0] !== undefined) {
            return _passedParams[0];
        }
        throw new Error('No directory provided!');
    }

    private getExcludedFiles(_passedParams: string[]): string {
        if (_passedParams[1] !== undefined && _passedParams[1].length > 0) {
            this.logger.info(`Following files skipped via parameter: ${_passedParams[1]}`);
            return _passedParams[1];
        }
        return '';
    }

    public override async run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
        const directory: string = this.getDirectory(_passedParams);
        const excludedFiles: string = this.getExcludedFiles(_passedParams);
        this.logger.info('Create seed data in the database...');
        let entityFileNames: string[] = this.dbSeedService.getEntityFileNames(directory);
        if (entityFileNames.length == 0) {
            this.logger.error(`No seeding data in the directory ${directory}!`);
            throw new Error('No seeding data in the directory');
        }
        entityFileNames = entityFileNames.filter((efm: string) => !excludedFiles.includes(efm));
        this.logger.info('Following files will be processed:');
        entityFileNames.forEach((n: string) => this.logger.info(n));
        try {
            for (const entityFileName of entityFileNames) {
                await this.processEntityFile(entityFileName, directory);
            }
            await this.orm.em.flush();
            this.logger.info('Created seed data successfully.');
        } catch (err) {
            this.logger.error('Seed data could not be created!');
            this.logger.error(String(err));
            throw err;
        }
    }

    private async processEntityFile(entityFileName: string, directory: string): Promise<void> {
        const fileContentAsStr: string = fs.readFileSync(`./seeding/${directory}/${entityFileName}`, 'utf-8');
        const seedFile: SeedFile = JSON.parse(fileContentAsStr) as SeedFile;
        this.logger.info(`Processing ${seedFile.entityName}`);
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
