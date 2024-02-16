import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DoFactory,
    KeycloakConfigTestModule,
    LoggingTestModule,
    MapperTestModule,
} from '../../../test/utils/index.js';
import { DbSeedService } from './db-seed.service.js';
import { DbSeedConsole } from './db-seed.console.js';
import { UserModule } from '../../modules/user/user.module.js';
import { UsernameGeneratorService } from '../../modules/user/username-generator.service.js';
import { DbSeedMapper } from './db-seed-mapper.js';
import { RolleEntity } from '../../modules/rolle/entity/rolle.entity.js';
import { KeycloakAdministrationModule } from '../../modules/keycloak-administration/keycloak-administration.module.js';
import { OrganisationEntity } from '../../modules/organisation/persistence/organisation.entity.js';
import { DataProviderEntity } from '../../persistence/data-provider.entity.js';
import { Rolle } from '../../modules/rolle/domain/rolle.js';
import { mapAggregateToData as mapRolleAggregateToData } from '../../modules/rolle/repo/rolle.repo.js';

describe('DbSeedConsole', () => {
    let module: TestingModule;
    let sut: DbSeedConsole;
    let orm: MikroORM;
    let dbSeedService: DbSeedService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }),
                ConfigTestModule,
                UserModule,
                KeycloakAdministrationModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                LoggingTestModule,
            ],
            providers: [DbSeedConsole, UsernameGeneratorService, DbSeedService, DbSeedMapper],
        }).compile();
        sut = module.get(DbSeedConsole);
        orm = module.get(MikroORM);
        dbSeedService = module.get(DbSeedService);

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
    }, 200000);

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    it('should be defined', () => {
        expect(dbSeedService).toBeDefined();
        expect(orm).toBeDefined();
    });

    describe('run', () => {
        describe('when no parameter for directory is provided', () => {
            it('should fail with error', async () => {
                await expect(sut.run([])).rejects.toThrow();
            });
        });

        describe('when directory and excluded files is set via parameter', () => {
            it('should use seeding-integration-test directory and not fail due to non-existing entityType', async () => {
                const params: string[] = ['seeding-integration-test/all', '07_non-existing-entity.json'];
                const role: Rolle<false> = DoFactory.createRolle(false, { id: 'd5732e12-5bca-4ef0-826b-3e910fcc7fd3' });
                await orm.em.fork().persistAndFlush(orm.em.create(RolleEntity, mapRolleAggregateToData(role)));
                await expect(sut.run(params)).resolves.not.toThrow();
                const dataProvider: Option<DataProviderEntity> = await orm.em.findOne(DataProviderEntity, {
                    id: '431d8433-759c-4dbe-aaab-00b9a781f467',
                });
                const rolle: Option<RolleEntity> = await orm.em.findOne(RolleEntity, {
                    id: '301457e9-4fe5-42a6-8084-fec927dc00df',
                });
                const organisation: Option<OrganisationEntity> = await orm.em.findOne(OrganisationEntity, {
                    id: 'cb3e7c7f-c8fb-4083-acbf-2484efb19b54',
                });
                if (!dataProvider || !rolle || !organisation) {
                    throw Error('At least one entity was not persisted correctly!');
                }
            });
        });

        describe('when directory set via parameter', () => {
            it('should use seeding-integration-test directory and fail due to non-existing entity-type', async () => {
                const params: string[] = ['seeding-integration-test/nonExistingEntity'];
                await expect(sut.run(params)).rejects.toThrow(
                    new Error(`Unsupported EntityName / EntityType: NonExistingEntityType`),
                );
            });
        });
    });
});
