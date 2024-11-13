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
import { EmailEventHandler } from './email-event-handler.js';
import { faker } from '@faker-js/faker';
import { EmailModule } from '../email.module.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { ServiceProviderKategorie } from '../../service-provider/domain/service-provider.enum.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { EventModule, EventService } from '../../../core/eventbus/index.js';
import { EmailFactory } from './email.factory.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { EmailRepo } from '../persistence/email.repo.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { EmailAddressNotFoundError } from '../error/email-address-not-found.error.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { RolleUpdatedEvent } from '../../../shared/events/rolle-updated.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
import { PersonID, RolleID } from '../../../shared/types/index.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { OxMetadataInKeycloakChangedEvent } from '../../../shared/events/ox-metadata-in-keycloak-changed.event.js';
import { OXContextName, OXUserID, OXUserName } from '../../../shared/types/ox-ids.types.js';
import { EntityCouldNotBeUpdated } from '../../../shared/error/entity-could-not-be-updated.error.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { Person } from '../../person/domain/person.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { EntityCouldNotBeCreated } from '../../../shared/error/entity-could-not-be-created.error.js';
import { PersonenkontextMigrationRuntype } from '../../personenkontext/domain/personenkontext.enums.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';

function getEmail(): EmailAddress<true> {
    const fakePersonId: PersonID = faker.string.uuid();
    const fakeEmailAddressId: string = faker.string.uuid();
    return EmailAddress.construct(
        fakeEmailAddressId,
        faker.date.past(),
        faker.date.recent(),
        fakePersonId,
        faker.internet.email(),
        EmailAddressStatus.ENABLED,
    );
}

describe('Email Event Handler', () => {
    let app: INestApplication;

    let emailEventHandler: EmailEventHandler;
    let emailFactoryMock: DeepMocked<EmailFactory>;
    let emailRepoMock: DeepMocked<EmailRepo>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let dbiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let serviceProviderRepoMock: DeepMocked<ServiceProviderRepo>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                MapperTestModule,
                EmailModule,
                EventModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: false }),
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
            ],
        })
            .overrideProvider(OrganisationRepository)
            .useValue(createMock<OrganisationRepository>())
            .overrideProvider(EmailFactory)
            .useValue(createMock<EmailFactory>())
            .overrideProvider(EmailRepo)
            .useValue(createMock<EmailRepo>())
            .overrideProvider(ServiceProviderRepo)
            .useValue(createMock<ServiceProviderRepo>())
            .overrideProvider(RolleRepo)
            .useValue(createMock<RolleRepo>())
            .overrideProvider(DBiamPersonenkontextRepo)
            .useValue(createMock<DBiamPersonenkontextRepo>())
            .overrideProvider(PersonRepository)
            .useValue(createMock<PersonRepository>())
            .overrideProvider(DBiamPersonenkontextRepo)
            .useValue(createMock<DBiamPersonenkontextRepo>())
            .overrideProvider(EmailEventHandler)
            .useClass(EmailEventHandler)
            .overrideProvider(EventService)
            .useClass(EventService)
            .overrideProvider(ClassLogger)
            .useValue(createMock<ClassLogger>())
            .compile();

        emailEventHandler = module.get(EmailEventHandler);
        emailFactoryMock = module.get(EmailFactory);
        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        emailRepoMock = module.get(EmailRepo);
        rolleRepoMock = module.get(RolleRepo);
        serviceProviderRepoMock = module.get(ServiceProviderRepo);
        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        loggerMock = module.get(ClassLogger);

        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    function mockEmailFactoryCreateNewReturnsEnabledEmail(fakeEmailAddress: string): void {
        // eslint-disable-next-line @typescript-eslint/require-await
        emailFactoryMock.createNew.mockImplementationOnce(async (personId: PersonID) => {
            const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                personId,
                fakeEmailAddress,
                EmailAddressStatus.ENABLED,
            );

            return {
                ok: true,
                value: emailAddress,
            };
        });
    }

    describe('handlePersonenkontextUpdatedEvent', () => {
        let fakePersonId: PersonID;
        let fakeRolleId: RolleID;
        let fakeEmailAddressString: string;
        let event: PersonenkontextUpdatedEvent;
        let personenkontexte: Personenkontext<true>[];
        let rolle: Rolle<true>;
        let rolleMap: Map<string, Rolle<true>>;
        let sp: ServiceProvider<true>;
        let spMap: Map<string, ServiceProvider<true>>;

        beforeEach(() => {
            jest.resetAllMocks();
            fakePersonId = faker.string.uuid();
            fakeRolleId = faker.string.uuid();
            fakeEmailAddressString = faker.internet.email();
            event = createMock<PersonenkontextUpdatedEvent>({ person: { id: fakePersonId } });

            personenkontexte = [createMock<Personenkontext<true>>({ rolleId: fakeRolleId })];
            rolle = createMock<Rolle<true>>({ id: fakeRolleId, serviceProviderIds: [] });
            rolleMap = new Map<string, Rolle<true>>();
            rolleMap.set(fakeRolleId, rolle);
            sp = createMock<ServiceProvider<true>>({
                kategorie: ServiceProviderKategorie.EMAIL,
            });
            spMap = new Map<string, ServiceProvider<true>>();
            spMap.set(sp.id, sp);
        });

        describe('when email exists and is enabled', () => {
            it('should log matching info', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementationOnce(async (personId: PersonID) => {
                    return new EmailAddress<true>(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.ENABLED,
                    );
                });

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Existing email for personId:${fakePersonId} already enabled`,
                );
            });
        });

        describe('when email exists but is disabled and enabling is successful', () => {
            it('should log matching info', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementationOnce(async (personId: PersonID) => {
                    return new EmailAddress<true>(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.DISABLED,
                    );
                });

                const persistedEmail: EmailAddress<true> = getEmail();
                emailRepoMock.save.mockResolvedValueOnce(persistedEmail);

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Set Requested status and persisted address:${persistedEmail.currentAddress}`,
                );
            });
        });

        describe('when email exists and but is disabled but enabling fails', () => {
            it('should log matching error', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementationOnce(async (personId: PersonID) => {
                    return new EmailAddress<true>(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.DISABLED,
                    );
                });

                emailRepoMock.save.mockResolvedValueOnce(new EmailAddressNotFoundError(fakeEmailAddressString));

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not enable email, error is requested EmailAddress with the address:${fakeEmailAddressString} was not found`,
                );
            });
        });

        describe('when email does NOT exist should create and persist a new one', () => {
            it('should log matching info', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(undefined); //no existing email is found

                const persistenceResult: EmailAddress<true> = getEmail();
                emailRepoMock.save.mockResolvedValueOnce(persistenceResult); //mock: error during saving the entity

                mockEmailFactoryCreateNewReturnsEnabledEmail(faker.internet.email());

                // eslint-disable-next-line @typescript-eslint/require-await
                emailFactoryMock.createNew.mockImplementationOnce(async (personId: PersonID) => {
                    const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.ENABLED,
                    );

                    return {
                        ok: true,
                        value: emailAddress,
                    };
                });

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Successfully persisted email with REQUEST status for address:${persistenceResult.currentAddress}`,
                );
            });
        });

        describe('when email does NOT exist and error occurs during creation', () => {
            it('should log matching info', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(undefined); //no existing email is found

                // eslint-disable-next-line @typescript-eslint/require-await
                emailFactoryMock.createNew.mockImplementationOnce(async (personId: PersonID) => {
                    return {
                        ok: false,
                        error: new EntityNotFoundError('Person', personId),
                    };
                });

                //mock persisting failed EmailAddress is successful
                emailRepoMock.save.mockResolvedValueOnce(
                    new EmailAddress<true>(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        faker.string.uuid(),
                        faker.internet.email(),
                        EmailAddressStatus.ENABLED,
                    ),
                );

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not create email, error is: requested Person with the following ID ${fakePersonId} was not found`,
                );
            });
        });

        //createAndPersistFailedEmailAddress is private, tested via handlePersonenkontextUpdatedEvent
        describe('createAndPersistFailedEmailAddress', () => {
            describe('when persisting EmailAddress with Failed status fails', () => {
                it('should log matching info', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(undefined); //no existing email is found

                    // eslint-disable-next-line @typescript-eslint/require-await
                    emailFactoryMock.createNew.mockImplementationOnce(async (personId: PersonID) => {
                        return {
                            ok: false,
                            error: new EntityNotFoundError('Person', personId),
                        };
                    });

                    //mock persisting failed EmailAddress has failed
                    emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeUpdated('EmailAddress', '1'));

                    await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                    expect(loggerMock.error).toHaveBeenCalledWith(
                        `Could not create email, error is: requested Person with the following ID ${fakePersonId} was not found`,
                    );
                });
            });
        });

        describe('when email does NOT exist and error occurs during persisting', () => {
            it('should log matching info', async () => {
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

                emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(undefined); //no existing email is found

                emailRepoMock.save.mockResolvedValueOnce(new EmailAddressNotFoundError(fakeEmailAddressString)); //mock: error during saving the entity

                // eslint-disable-next-line @typescript-eslint/require-await
                emailFactoryMock.createNew.mockImplementationOnce(async (personId: PersonID) => {
                    const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.ENABLED,
                    );

                    return {
                        ok: true,
                        value: emailAddress,
                    };
                });

                await emailEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not persist email, error is requested EmailAddress with the address:${fakeEmailAddressString} was not found`,
                );
            });
        });
    });

    describe('handlePersonenkontextCreatedMigrationEvent', () => {
        describe('MigrationRunType: STANDARD', () => {
            const migrationType: PersonenkontextMigrationRuntype = PersonenkontextMigrationRuntype.STANDARD;
            it('should do nothing when rolle is not LEHR', async () => {
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
                    'test@schule-spsh.de',
                );

                await emailEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('No Action because Rollenart is Not LEHR'),
                );
            });
            it('should Create Email When None Exists and Rollenart is LEHR', async () => {
                const inputEmailAdress: string = 'test@schule-spsh.de';

                const personenkontext: Personenkontext<true> = createMock<Personenkontext<true>>();
                const person: Person<true> = createMock<Person<true>>();
                const rolle: Rolle<true> = createMock<Rolle<true>>();
                const orga: Organisation<true> = createMock<Organisation<true>>();

                rolle.rollenart = RollenArt.LEHR;

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    inputEmailAdress,
                );

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockImplementationOnce(async () => {
                    return undefined;
                });
                emailRepoMock.save.mockResolvedValueOnce(createMock<EmailAddress<true>>());

                await emailEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Successfully persisted Email'));
            });
            it('should Log Error When Email persisting Operation fails', async () => {
                const inputEmailAdress: string = 'test@schule-spsh.de';

                const personenkontext: Personenkontext<true> = createMock<Personenkontext<true>>();
                const person: Person<true> = createMock<Person<true>>();
                const rolle: Rolle<true> = createMock<Rolle<true>>();
                const orga: Organisation<true> = createMock<Organisation<true>>();

                rolle.rollenart = RollenArt.LEHR;

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    inputEmailAdress,
                );

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementationOnce(async () => {
                    return undefined;
                });
                emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeCreated(''));

                await emailEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Could not persist existing email, error is'),
                );
            });
            it('should Abort When email is already persisted', async () => {
                const inputEmailAdress: string = 'test@schule-spsh.de';

                const personenkontext: Personenkontext<true> = createMock<Personenkontext<true>>();
                const person: Person<true> = createMock<Person<true>>();
                const rolle: Rolle<true> = createMock<Rolle<true>>();
                const orga: Organisation<true> = createMock<Organisation<true>>();

                rolle.rollenart = RollenArt.LEHR;

                const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                    migrationType,
                    personenkontext,
                    person,
                    rolle,
                    orga,
                    inputEmailAdress,
                );

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementationOnce(async () => {
                    return createMock<EmailAddress<true>>();
                });
                emailRepoMock.save.mockResolvedValueOnce(createMock<EmailAddress<true>>());

                await emailEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('Aborting persist Email Operation, Email already exists'),
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
                    'test@schule-spsh.de',
                );

                await emailEventHandler.handlePersonenkontextCreatedMigrationEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    expect.stringContaining('No Action because PersonenkontextMigrationRuntype is Not STANDARD'),
                );
            });
        });
    });

    describe('handlePersonRenamedEvent', () => {
        let fakePersonId: PersonID;
        let fakeRolleId: RolleID;
        let fakeEmailAddress: string;
        let event: PersonRenamedEvent;
        let personenkontext: Personenkontext<true>;
        let rolle: Rolle<true>;
        let rollenMap: Map<string, Rolle<true>>;
        let sp: ServiceProvider<true>;
        let spMap: Map<string, ServiceProvider<true>>;
        let emailAddress: EmailAddress<true>;

        beforeEach(() => {
            fakePersonId = faker.string.uuid();
            fakeRolleId = faker.string.uuid();
            fakeEmailAddress = faker.internet.email();
            event = new PersonRenamedEvent(
                fakePersonId,
                faker.person.firstName(),
                faker.person.lastName(),
                faker.internet.userName(),
                faker.internet.userName(),
            );
            personenkontext = createMock<Personenkontext<true>>({ rolleId: fakeRolleId });
            rolle = createMock<Rolle<true>>({ id: fakeRolleId });
            rollenMap = new Map<string, Rolle<true>>();
            rollenMap.set(fakeRolleId, rolle);
            sp = createMock<ServiceProvider<true>>({
                kategorie: ServiceProviderKategorie.EMAIL,
            });
            spMap = new Map<string, ServiceProvider<true>>();
            spMap.set(sp.id, sp);
            rolleRepoMock.findById.mockResolvedValueOnce(rolle);
            emailAddress = EmailAddress.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                fakePersonId,
                fakeEmailAddress,
                EmailAddressStatus.ENABLED,
            );
        });

        describe('when rolle exists and service provider with kategorie email is found', () => {
            describe('when enabled email already exists and save disabling is successful', () => {
                it('should log info only', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(emailAddress);

                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    //mock createNewEmail
                    mockEmailFactoryCreateNewReturnsEnabledEmail(fakeEmailAddress);

                    //mock persisting new email
                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                    expect(loggerMock.info).toHaveBeenCalledWith(`Disabled and saved address:${emailAddress.address}`);
                });
            });

            describe('when enabled email already exists and creating new (changed) email via factory fails', () => {
                it('should log error', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(emailAddress);

                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    //mock createNewEmail
                    emailFactoryMock.createNew.mockResolvedValueOnce({
                        ok: false,
                        error: new EntityCouldNotBeCreated('EmailAddress'),
                    });

                    //mock persisting new email
                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                    expect(loggerMock.info).toHaveBeenCalledWith(`Disabled and saved address:${emailAddress.address}`);
                    expect(loggerMock.error).toHaveBeenLastCalledWith(
                        'Could not create change-email, error is EmailAddress could not be created',
                    );
                });
            });

            describe('when enabled email already exists and creating new (changed) email via factory succeeds but persisting fails', () => {
                it('should log error', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(emailAddress);

                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    //mock createNewEmail
                    mockEmailFactoryCreateNewReturnsEnabledEmail(fakeEmailAddress);

                    //mock persisting new email
                    emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeCreated('EmailAddress'));

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                    expect(loggerMock.info).toHaveBeenCalledWith(`Disabled and saved address:${emailAddress.address}`);
                    expect(loggerMock.error).toHaveBeenLastCalledWith(
                        'Could not persist change-email, error is EmailAddress could not be created',
                    );
                });
            });

            describe('when enabled email DOES NOT exist and creating new email is successfull', () => {
                it('should log info', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(undefined);

                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    //mock createNewEmail
                    mockEmailFactoryCreateNewReturnsEnabledEmail(fakeEmailAddress);

                    //mock persisting new email
                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                });
            });

            describe('when NO rolle is referencing a SP with Email kategorie', () => {
                it('should log info only', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(new Map<string, ServiceProvider<true>>());

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(emailRepoMock.findByPersonSortedByUpdatedAtDesc).toHaveBeenCalledTimes(0);
                    expect(emailRepoMock.save).toHaveBeenCalledTimes(0);
                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                    expect(loggerMock.info).toHaveBeenLastCalledWith(
                        `Renamed person with personId:${event.personId} has no SP with Email, nothing to do`,
                    );
                });
            });

            describe('when enabled email already exists and save disabling results in error', () => {
                it('should log error', async () => {
                    dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontext]);
                    rolleRepoMock.findByIds.mockResolvedValueOnce(rollenMap);
                    serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
                    emailRepoMock.findEnabledByPerson.mockResolvedValueOnce(emailAddress);

                    emailRepoMock.save.mockResolvedValueOnce(new EmailAddressNotFoundError(fakeEmailAddress));

                    //mock createNewEmail
                    mockEmailFactoryCreateNewReturnsEnabledEmail(fakeEmailAddress);

                    //mock persisting new email
                    emailRepoMock.save.mockResolvedValueOnce(emailAddress);

                    await emailEventHandler.handlePersonRenamedEvent(event);

                    expect(loggerMock.info).toHaveBeenCalledWith(
                        `Received PersonRenamedEvent, personId:${event.personId}`,
                    );
                    expect(loggerMock.error).toHaveBeenCalledWith(
                        `Could not disable email, error is requested EmailAddress with the address:${fakeEmailAddress} was not found`,
                    );
                });
            });
        });
    });

    describe('handlePersonDeletedEvent', () => {
        let personId: string;
        let referrer: string;
        let emailAddress: string;
        let event: PersonDeletedEvent;

        beforeEach(() => {
            personId = faker.string.uuid();
            referrer = faker.string.alpha();
            emailAddress = faker.internet.email();
            event = new PersonDeletedEvent(personId, referrer, emailAddress);
        });

        describe('when deletion is successful', () => {
            it('should log info', async () => {
                await emailEventHandler.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(`Successfully deactivated email-address:${emailAddress}`);
            });
        });

        describe('when event does not provide email-address', () => {
            it('should log info about that', async () => {
                event = new PersonDeletedEvent(personId, referrer, undefined);
                await emailEventHandler.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Cannot deactivate email-address, person did not have an email-address`,
                );
            });
        });

        describe('when email-address for deletion cannot be found', () => {
            it('should log error', async () => {
                emailRepoMock.deactivateEmailAddress.mockResolvedValueOnce(new EmailAddressNotFoundError());
                await emailEventHandler.handlePersonDeletedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Deactivation of email-address:${event.emailAddress} failed`,
                );
            });
        });
    });

    describe('handleRolleUpdatedEvent', () => {
        let fakeRolleId: string;
        let fakePersonId: string;
        let personenkontexte: Personenkontext<true>[] = [];
        let event: RolleUpdatedEvent;
        let sp: ServiceProvider<true>;
        let spMap: Map<string, ServiceProvider<true>>;
        let rolle: Rolle<true>;
        let rolleMap: Map<string, Rolle<true>>;

        beforeEach(() => {
            fakeRolleId = faker.string.uuid();
            personenkontexte = [
                createMock<Personenkontext<true>>({ personId: fakePersonId }),
                createMock<Personenkontext<true>>({ personId: fakePersonId }),
                createMock<Personenkontext<true>>({ personId: faker.string.uuid() }),
            ];
            event = new RolleUpdatedEvent(fakeRolleId, faker.helpers.enumValue(RollenArt), [], [], []);
            rolle = createMock<Rolle<true>>({ serviceProviderIds: [] });
            rolleMap = new Map<string, Rolle<true>>();
            rolleMap.set(fakeRolleId, rolle);
            sp = createMock<ServiceProvider<true>>({
                kategorie: ServiceProviderKategorie.EMAIL,
            });
            spMap = new Map<string, ServiceProvider<true>>();
            spMap.set(sp.id, sp);
        });

        describe('when rolle is updated', () => {
            it('should log info', async () => {
                dbiamPersonenkontextRepoMock.findByRolle.mockResolvedValueOnce(personenkontexte);

                //in the following enabling, persisting and so on is mocked for all PKs, testing handlePerson-method is done in other test cases
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValue(personenkontexte);
                rolleRepoMock.findByIds.mockResolvedValue(rolleMap);
                serviceProviderRepoMock.findByIds.mockResolvedValue(spMap);

                // eslint-disable-next-line @typescript-eslint/require-await
                emailRepoMock.findEnabledByPerson.mockImplementation(async (personId: PersonID) => {
                    return new EmailAddress<true>(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        personId,
                        faker.internet.email(),
                        EmailAddressStatus.DISABLED,
                    );
                });

                const persistedEmail: EmailAddress<true> = getEmail();
                emailRepoMock.save.mockResolvedValue(persistedEmail);

                await emailEventHandler.handleRolleUpdatedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(`RolleUpdatedEvent affects:2 persons`);
            });
        });

        describe('when rolle is updated but person should not get an email-address by event', () => {
            it('should log info', async () => {
                dbiamPersonenkontextRepoMock.findByRolle.mockResolvedValueOnce(personenkontexte);

                //mock that no email-address is necessary for person to test handlePerson
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValue([]);
                rolleRepoMock.findByIds.mockResolvedValue(new Map<string, Rolle<true>>());
                serviceProviderRepoMock.findByIds.mockResolvedValue(new Map<string, ServiceProvider<true>>());

                await emailEventHandler.handleRolleUpdatedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(`Person with id:${fakePersonId} does not need an email`);
            });
        });
    });

    describe('handleOxUserAttributesCreatedEvent', () => {
        let fakePersonId: string;
        let fakeKeycloakUsername: string;
        let fakeOXUserId: OXUserID;
        let fakeOXUserName: OXUserName;
        let fakeOXContextName: OXContextName;
        let fakeEmail: string;
        let event: OxMetadataInKeycloakChangedEvent;

        beforeEach(() => {
            fakePersonId = faker.string.uuid();
            fakeKeycloakUsername = faker.internet.userName();
            fakeOXUserId = faker.string.numeric();
            fakeOXUserName = fakeKeycloakUsername;
            fakeOXContextName = 'context1';
            fakeEmail = faker.internet.email();
            event = new OxMetadataInKeycloakChangedEvent(
                fakePersonId,
                fakeKeycloakUsername,
                fakeOXUserId,
                fakeOXUserName,
                fakeOXContextName,
                fakeEmail,
            );
        });

        describe('when email cannot be found by personId', () => {
            it('should log error', async () => {
                emailRepoMock.findRequestedByPerson.mockResolvedValueOnce(undefined);

                await emailEventHandler.handleOxMetadataInKeycloakChangedEvent(event);

                expect(loggerMock.error).toHaveBeenLastCalledWith(
                    `Cannot find requested email-address for person with personId:${event.personId}, enabling not possible`,
                );
            });
        });

        describe('when email-address from OX and requested email-address are not equal', () => {
            it('should log error', async () => {
                const emailAddress: string = faker.internet.email();
                emailRepoMock.findRequestedByPerson.mockResolvedValueOnce(
                    createMock<EmailAddress<true>>({
                        get address(): string {
                            return emailAddress;
                        },
                    }),
                );

                emailRepoMock.save.mockResolvedValueOnce(createMock<EmailAddress<true>>({}));

                await emailEventHandler.handleOxMetadataInKeycloakChangedEvent(event);

                expect(loggerMock.warning).toHaveBeenCalledWith(
                    `Mismatch between requested(${emailAddress}) and received(${event.emailAddress}) address from OX`,
                );
                expect(loggerMock.warning).toHaveBeenLastCalledWith(
                    `Overriding ${emailAddress} with ${event.emailAddress}) from OX`,
                );
            });
        });

        describe('when persisting changes to email-address fails', () => {
            it('should log error', async () => {
                emailRepoMock.findRequestedByPerson.mockResolvedValueOnce(
                    createMock<EmailAddress<true>>({
                        get address(): string {
                            return fakeEmail;
                        },
                    }),
                );

                emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeUpdated('EmailAddress', '1'));

                await emailEventHandler.handleOxMetadataInKeycloakChangedEvent(event);

                expect(loggerMock.error).toHaveBeenLastCalledWith(
                    `Could not enable email, error is EmailAddress with ID 1 could not be updated`,
                );
            });
        });

        describe('when changing email status is successful', () => {
            it('should log info', async () => {
                const emailMock: EmailAddress<true> = createMock<EmailAddress<true>>({
                    get address(): string {
                        return fakeEmail;
                    },
                });
                emailRepoMock.findRequestedByPerson.mockResolvedValueOnce(emailMock);

                emailRepoMock.save.mockResolvedValueOnce(emailMock);

                await emailEventHandler.handleOxMetadataInKeycloakChangedEvent(event);

                expect(loggerMock.info).toHaveBeenLastCalledWith(
                    `Changed email-address:${fakeEmail} from REQUESTED to ENABLED`,
                );
            });
        });
    });
});
