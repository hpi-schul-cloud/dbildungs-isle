import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    KeycloakConfigTestModule,
    LoggingTestModule,
    MapperTestModule,
} from '../../../test/utils/index.js';
import { DbSeedService } from './domain/db-seed.service.js';
import { DbSeedConsole } from './db-seed.console.js';
import { UsernameGeneratorService } from '../../modules/person/domain/username-generator.service.js';
import { KeycloakAdministrationModule } from '../../modules/keycloak-administration/keycloak-administration.module.js';
import { KeycloakConfigModule } from '../../modules/keycloak-administration/keycloak-config.module.js';
import { OrganisationModule } from '../../modules/organisation/organisation.module.js';
import { DBiamPersonenkontextRepo } from '../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonModule } from '../../modules/person/person.module.js';
import { RolleModule } from '../../modules/rolle/rolle.module.js';
import { ServiceProviderModule } from '../../modules/service-provider/service-provider.module.js';
import { DbSeedModule } from './db-seed.module.js';

describe('DbSeedConsoleIntegration', () => {
    let module: TestingModule;
    let sut: DbSeedConsole;
    let orm: MikroORM;
    let dbSeedService: DbSeedService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                DbSeedModule,
                ConfigTestModule,
                OrganisationModule,
                KeycloakAdministrationModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                LoggingTestModule,
                PersonModule,
                RolleModule,
                ServiceProviderModule,
            ],
            providers: [UsernameGeneratorService, DBiamPersonenkontextRepo],
        })
            .overrideModule(KeycloakConfigModule)
            .useModule(KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }))
            .compile();
        sut = module.get(DbSeedConsole);
        orm = module.get(MikroORM);
        dbSeedService = module.get(DbSeedService);

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
    }, 10000000);

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    afterAll(async () => {
        await orm.close();
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
        describe('when parameter for directory is provided and seeding-files are valid', () => {
            it('should NOT fail', async () => {
                const params: string[] = ['seeding-integration-test/all'];
                await expect(sut.run(params)).resolves.not.toThrow();
            });
        });

        describe('skips files if seeding already happened', () => {
            it('should NOT fail', async () => {
                const params: string[] = ['seeding-integration-test/all'];

                await sut.run(params);

                await expect(sut.run(params)).resolves.not.toThrow();
            });
        });

        describe('when no parameter for directory is provided', () => {
            it('should fail with error', async () => {
                await expect(sut.run([])).rejects.toThrow();
            });
        });

        describe('when directory for seeding files is empty or no matching files are found within', () => {
            it('should fail with error', async () => {
                const params: string[] = ['seeding-integration-test/emptyDir'];
                await expect(sut.run(params)).rejects.toThrow();
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
