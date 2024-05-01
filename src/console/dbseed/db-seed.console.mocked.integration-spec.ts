import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    KeycloakConfigTestModule,
    LoggingTestModule,
    MapperTestModule,
} from '../../../test/utils/index.js';
import { DbSeedService } from './db-seed.service.js';
import { DbSeedConsole } from './db-seed.console.js';
import { createMock } from '@golevelup/ts-jest';
import { KeycloakUserService } from '../../modules/keycloak-administration/domain/keycloak-user.service.js';
import { PersonRepository } from '../../modules/person/persistence/person.repository.js';
import { PersonFactory } from '../../modules/person/domain/person.factory.js';
import { OrganisationModule } from '../../modules/organisation/organisation.module.js';
import { DBiamPersonenkontextRepo } from '../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { UsernameGeneratorService } from '../../modules/person/domain/username-generator.service.js';
import { RolleModule } from '../../modules/rolle/rolle.module.js';
import { ServiceProviderModule } from '../../modules/service-provider/service-provider.module.js';
import { DbSeedModule } from './db-seed.module.js';

describe('DbSeedConsoleMockedKeycloak', () => {
    let module: TestingModule;
    let sut: DbSeedConsole;
    let orm: MikroORM;
    let dbSeedService: DbSeedService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                DbSeedModule,
                KeycloakConfigTestModule.forRoot({ isKeycloakRequired: false }),
                OrganisationModule,
                ConfigTestModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                LoggingTestModule,
                RolleModule,
                ServiceProviderModule,
            ],
            providers: [
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: PersonFactory,
                    useValue: createMock<PersonFactory>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
            ],
        }).compile();
        sut = module.get(DbSeedConsole);
        orm = module.get(MikroORM);
        dbSeedService = module.get(DbSeedService);

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
    }, 100000);

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
});
