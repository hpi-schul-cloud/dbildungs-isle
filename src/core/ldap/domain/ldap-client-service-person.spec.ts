import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    LdapTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';
import { LdapConfigModule } from '../ldap-config.module.js';
import { LdapModule } from '../ldap.module.js';
import { faker } from '@faker-js/faker';
import { OrganisationsTyp } from '../../../modules/organisation/domain/organisation.enums.js';
import { LdapClientService } from './ldap-client.service.js';
import { Person } from '../../../modules/person/domain/person.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';

describe('LDAP Client Service Person Methods', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let module: TestingModule;
    let ldapClientService: LdapClientService;
    const id: string = faker.string.uuid();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                LdapModule,
                MapperTestModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
            ],
        })
            .overrideModule(LdapConfigModule)
            .useModule(LdapTestModule.forRoot({ isLdapRequired: true }))
            .compile();

        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        ldapClientService = module.get(LdapClientService);

        //currently only used to wait for the LDAP container, because setupDatabase() is blocking
        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await DatabaseTestModule.clearDatabase(orm);
        await orm.close();
        await app.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    it('should be defined', () => {
        expect(em).toBeDefined();
    });

    describe('createLehrer', () => {
        describe('when called with valid person and organisation', () => {
            it('should return truthy result', async () => {
                //create an OU
                const ouId: string = faker.string.uuid();
                const ouKennung: string = faker.string.numeric({ length: 7 });
                const ou: Organisation<true> = Organisation.construct(
                    ouId,
                    faker.date.past(),
                    faker.date.recent(),
                    undefined,
                    undefined,
                    ouKennung,
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                const ouResult: Result<Organisation<true>> = await ldapClientService.createOrganisation(ou);

                expect(ouResult.ok).toBeTruthy();
                //

                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.person.lastName(),
                    faker.person.firstName(),
                    '1',
                    faker.lorem.word(),
                    undefined,
                    faker.string.uuid(),
                );

                const organisation: Organisation<true> = {
                    id: ouId,
                    name: faker.company.name(),
                    kennung: ouKennung,
                    typ: OrganisationsTyp.SCHULE,
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                };

                const result: Result<Person<true>> = await ldapClientService.createLehrer(person, organisation);

                expect(result.ok).toBeTruthy();
            });
        });

        describe('when called with valid person and an organisation without kennung', () => {
            it('should return error result', async () => {
                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.person.lastName(),
                    faker.person.firstName(),
                    '1',
                    faker.lorem.word(),
                    undefined,
                    faker.string.uuid(),
                );

                const organisation: Organisation<true> = {
                    id: id,
                    name: faker.company.name(),
                    kennung: undefined,
                    typ: OrganisationsTyp.SCHULE,
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                };

                const result: Result<Person<true>> = await ldapClientService.createLehrer(person, organisation);

                expect(result.ok).toBeFalsy();
            });
        });
    });

    describe('deleteLehrer', () => {
        describe('when called with valid person and organisation', () => {
            it('should return truthy result', async () => {
                //create an OU
                const deleteLehrerOrgaKennung: string = faker.string.numeric({ length: 7 });
                const deleteLehrerPersonFirstname: string = faker.person.firstName();
                const deleteLehrerPersonLastname: string = faker.person.lastName();
                const deleteLehrerSchuleName: string = faker.string.alpha({ length: 10 });
                const ouId: string = faker.string.uuid();
                const ou: Organisation<true> = Organisation.construct(
                    ouId,
                    faker.date.past(),
                    faker.date.recent(),
                    undefined,
                    undefined,
                    deleteLehrerOrgaKennung,
                    deleteLehrerSchuleName,
                    undefined,
                    undefined,
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                const ouResult: Result<Organisation<true>> = await ldapClientService.createOrganisation(ou);
                expect(ouResult).toBeTruthy();

                //create lehrer
                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    deleteLehrerPersonLastname,
                    deleteLehrerPersonFirstname,
                    '1',
                    faker.lorem.word(),
                    undefined,
                    faker.string.uuid(),
                );
                const lehrer: Result<Person<true>> = await ldapClientService.createLehrer(person, ou);
                expect(lehrer.ok).toBeTruthy();

                //
                const result: Result<Person<true>> = await ldapClientService.deleteLehrer(person, ou);

                expect(result.ok).toBeTruthy();
            });
        });

        describe('when called with valid person and an organisation without kennung', () => {
            it('should return error result', async () => {
                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.person.lastName(),
                    faker.person.firstName(),
                    '1',
                    faker.lorem.word(),
                    undefined,
                    faker.string.uuid(),
                );

                const organisation: Organisation<true> = {
                    id: id,
                    name: faker.string.alpha(),
                    kennung: undefined,
                    typ: OrganisationsTyp.SCHULE,
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                };

                const result: Result<Person<true>> = await ldapClientService.deleteLehrer(person, organisation);

                expect(result.ok).toBeFalsy();
            });
        });
    });
});
