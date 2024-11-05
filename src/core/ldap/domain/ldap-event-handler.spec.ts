import { MikroORM } from '@mikro-orm/core';
import { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';

import { LdapModule } from '../ldap.module.js';
import { LdapEventHandler } from './ldap-event-handler.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { LdapClientService } from './ldap-client.service.js';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { RolleRepo } from '../../../modules/rolle/repo/rolle.repo.js';
import { faker } from '@faker-js/faker';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { DBiamPersonenkontextRepo } from '../../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextFactory } from '../../../modules/personenkontext/domain/personenkontext.factory.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { LdapSearchError } from '../error/ldap-search.error.js';
import { LdapEntityType } from './ldap.types.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { Personenkontext } from '../../../modules/personenkontext/domain/personenkontext.js';
import { Person } from '../../../modules/person/domain/person.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { Rolle } from '../../../modules/rolle/domain/rolle.js';
import { PersonenkontextMigrationRuntype } from '../../../modules/personenkontext/domain/personenkontext.enums.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';

describe('LDAP Event Handler', () => {
    let app: INestApplication;
    let orm: MikroORM;

    let ldapEventHandler: LdapEventHandler;
    let ldapClientServiceMock: DeepMocked<LdapClientService>;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
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
            .overrideProvider(ClassLogger)
            .useValue(createMock<ClassLogger>())
            .overrideProvider(LdapClientService)
            .useValue(createMock<LdapClientService>())
            .overrideProvider(PersonRepository)
            .useValue(createMock<PersonRepository>())
            .overrideProvider(PersonenkontextFactory)
            .useClass(PersonenkontextFactory)
            .overrideProvider(RolleRepo)
            .useValue(createMock<RolleRepo>())
            .overrideProvider(DBiamPersonenkontextRepo)
            .useValue(createMock<DBiamPersonenkontextRepo>())
            .overrideProvider(OrganisationRepository)
            .useValue(createMock<OrganisationRepository>())
            .overrideProvider(ClassLogger)
            .useValue(createMock<ClassLogger>())
            .compile();

        orm = module.get(MikroORM);

        loggerMock = module.get(ClassLogger);

        ldapEventHandler = module.get(LdapEventHandler);
        ldapClientServiceMock = module.get(LdapClientService);
        organisationRepositoryMock = module.get(OrganisationRepository);
        loggerMock = module.get(ClassLogger);

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await app.close();
    });

    beforeEach(async () => {
        jest.resetAllMocks();
        await DatabaseTestModule.clearDatabase(orm);
    });

    describe('handlePersonenkontextCreatedMigrationEvent', () => {
        describe('MigrationRunType: STANDARD', () => {
            const migrationType: PersonenkontextMigrationRuntype = PersonenkontextMigrationRuntype.STANDARD;

            let personenkontext: Personenkontext<true>;
            let person: Person<true>;
            let rolle: Rolle<true>;
            let orga: Organisation<true>;

            beforeEach(() => {
                personenkontext = createMock<Personenkontext<true>>();
                person = createMock<Person<true>>();
                rolle = createMock<Rolle<true>>();
                orga = createMock<Organisation<true>>();
            });

            it('should do nothing when rolle is not LEHR', async () => {
                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('Do Nothing because Rollenart is Not LEHR'),
                );
            });

            it('should created LDAP entry', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = '12345678';

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('Successfully created LDAP Entry Lehrer'),
                );
            });

            it('should log error if username is missing', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = undefined;

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Username missing'));
            });

            it('should log error if kennung is missing', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = undefined;

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Orga Kennung missing'));
            });

            it('should log error if isLehrerExisting check fails', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = '12345678';

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                ldapClientServiceMock.isLehrerExisting.mockResolvedValueOnce({
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                });

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Check Lehrer existing call failed'),
                );
            });

            it('should abort creatingLehrer if no valid emailDomain for organisation is found', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = '12345678';

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce(undefined);

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);

                expect(loggerMock.error).toHaveBeenLastCalledWith(
                    expect.stringContaining(
                        `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Aborting createLehrer Operation, No valid emailDomain for organisation`,
                    ),
                );
                expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(0);
            });

            it('should abort creatingLehrer if already exists', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = '12345678';

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                ldapClientServiceMock.isLehrerExisting.mockResolvedValueOnce({
                    ok: true,
                    value: true,
                });

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('Aborting createLehrer Operation, LDAP Entry already exists'),
                );
            });

            it('should log error if createLehrer Operation fails', async () => {
                rolle.rollenart = RollenArt.LEHR;
                person.referrer = 'user123';
                orga.kennung = '12345678';

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    'test@schule-spsh.de',
                );

                ldapClientServiceMock.isLehrerExisting.mockResolvedValueOnce({
                    ok: true,
                    value: false,
                });

                ldapClientServiceMock.createLehrer.mockResolvedValueOnce({
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                });

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Create Lehrer Operation failed'),
                );
            });
        });

        describe('MigrationRunType: ITSLEARNING', () => {
            const migrationType: PersonenkontextMigrationRuntype = PersonenkontextMigrationRuntype.ITSLEARNING;
            it('should do nothing', async () => {
                const personenkontext: Personenkontext<true> = createMock<Personenkontext<true>>();
                const person: Person<true> = createMock<Person<true>>();
                const rolle: Rolle<true> = createMock<Rolle<true>>();
                const orga: Organisation<true> = createMock<Organisation<true>>();

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                );

                await ldapEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('Do Nothing because PersonenkontextMigrationRuntype is Not STANDARD'),
                );
            });
        });
    });

    describe('handlePersonDeletedEvent', () => {
        describe('when calling LdapClientService.deleteLehrerByPersonId is successful', () => {
            it('should NOT log errors', async () => {
                const deletionResult: Result<PersonID> = {
                    ok: true,
                    value: faker.string.uuid(),
                };
                ldapClientServiceMock.deleteLehrerByPersonId.mockResolvedValueOnce(deletionResult);

                await ldapEventHandler.handlePersonDeletedEvent(createMock<PersonDeletedEvent>());

                expect(loggerMock.error).toHaveBeenCalledTimes(0);
            });
        });

        describe('when calling LdapClientService.deleteLehrerByPersonId is return error', () => {
            it('should log errors', async () => {
                const error: LdapSearchError = new LdapSearchError(LdapEntityType.LEHRER);
                const deletionResult: Result<PersonID> = {
                    ok: false,
                    error: error,
                };
                ldapClientServiceMock.deleteLehrerByPersonId.mockResolvedValueOnce(deletionResult);

                await ldapEventHandler.handlePersonDeletedEvent(createMock<PersonDeletedEvent>());

                expect(loggerMock.error).toHaveBeenCalledTimes(1);
                expect(loggerMock.error).toHaveBeenCalledWith(error.message);
            });
        });
    });

    describe('handlePersonenkontextUpdatedEvent', () => {
        it('should call ldap client for every new personenkontext with correct role', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
                [],
            );

            organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(1);
        });

        it('when organisation of created PK has no valid emailDomain should log error', async () => {
            const createdPKOrgaId: string = faker.string.uuid();
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: createdPKOrgaId,
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
                [],
            );

            organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce(undefined);

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `LdapClientService createLehrer NOT called, because organisation:${createdPKOrgaId} has no valid emailDomain`,
            );
            expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(0);
        });

        it('should call ldap client for every deleted personenkontext with correct role', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
            );

            organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.deleteLehrer).toHaveBeenCalledTimes(1);
        });

        it('when organisation of deleted PK has no valid emailDomain should log error', async () => {
            const removedOrgaId: string = faker.string.uuid();
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: removedOrgaId,
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
            );

            organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce(undefined);

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `LdapClientService deleteLehrer NOT called, because organisation:${removedOrgaId} has no valid emailDomain`,
            );
            expect(ldapClientServiceMock.deleteLehrer).toHaveBeenCalledTimes(0);
        });

        describe('when ldap client fails', () => {
            it('should execute without errors, if creation of lehrer fails', async () => {
                const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                    {
                        id: faker.string.uuid(),
                        vorname: faker.person.firstName(),
                        familienname: faker.person.lastName(),
                        referrer: faker.internet.userName(),
                    },
                    [
                        {
                            id: faker.string.uuid(),
                            orgaId: faker.string.uuid(),
                            rolle: RollenArt.LEHR,
                            rolleId: faker.string.uuid(),
                            orgaKennung: faker.string.numeric(7),
                            serviceProviderExternalSystems: [],
                        },
                    ],
                    [],
                    [],
                );
                ldapClientServiceMock.createLehrer.mockResolvedValueOnce({ ok: false, error: new Error('Error') });

                organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

                await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(1);
            });
        });

        it('should execute without errors, if deletion of lehrer fails', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
            );
            ldapClientServiceMock.deleteLehrer.mockResolvedValueOnce({
                ok: false,
                error: new Error('Error'),
            });

            organisationRepositoryMock.findEmailDomainForOrganisation.mockResolvedValueOnce('schule-sh.de');

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.deleteLehrer).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleEmailAddressGeneratedEvent', () => {
        it('should call ldap client changeEmailAddressByPersonId', async () => {
            const event: EmailAddressGeneratedEvent = new EmailAddressGeneratedEvent(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.internet.email(),
                true,
            );

            await ldapEventHandler.handleEmailAddressGeneratedEvent(event);

            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Received EmailAddressGeneratedEvent, personId:${event.personId}, emailAddress: ${event.address}`,
            );
            expect(ldapClientServiceMock.changeEmailAddressByPersonId).toHaveBeenCalledTimes(1);
        });
    });
});
