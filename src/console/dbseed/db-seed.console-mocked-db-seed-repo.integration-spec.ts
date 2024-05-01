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
import { DbSeedRepo } from './repo/db-seed.repo.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DbSeed } from './domain/db-seed.js';
import { DbSeedStatus } from './repo/db-seed.entity.js';
import { DBiamPersonenkontextService } from '../../modules/personenkontext/domain/dbiam-personenkontext.service.js';
import { DbSeedReferenceRepo } from './repo/db-seed-reference.repo.js';

describe('DbSeedConsoleMockedDbSeedRepo', () => {
    let module: TestingModule;
    let sut: DbSeedConsole;
    let orm: MikroORM;
    let dbSeedService: DbSeedService;
    let dbSeedRepoMock: DeepMocked<DbSeedRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
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
            providers: [
                UsernameGeneratorService,
                DBiamPersonenkontextRepo,
                DbSeedConsole,
                DbSeedService,
                DBiamPersonenkontextService,
                DbSeedReferenceRepo,
                {
                    provide: DbSeedRepo,
                    useValue: createMock<DbSeedRepo>(),
                },
            ],
        })
            .overrideModule(KeycloakConfigModule)
            .useModule(KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }))
            .compile();
        sut = module.get(DbSeedConsole);
        orm = module.get(MikroORM);
        dbSeedRepoMock = module.get(DbSeedRepo);
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
        describe('skips files if previous seeding already happened and failures occurred', () => {
            it('should NOT fail', async () => {
                const params: string[] = ['seeding-integration-test/all'];

                const dbSeedMock: DbSeed<true> = createMock<DbSeed<true>>({ status: DbSeedStatus.FAILED });
                dbSeedRepoMock.findById.mockResolvedValue(dbSeedMock);

                await expect(sut.run(params)).resolves.not.toThrow();
            });
        });
    });
});
