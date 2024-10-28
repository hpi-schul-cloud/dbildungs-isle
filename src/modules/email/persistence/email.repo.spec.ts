import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
} from '../../../../test/utils/index.js';
import { EmailRepo } from './email.repo.js';
import { EmailFactory } from '../domain/email.factory.js';
import { createMock } from '@golevelup/ts-jest';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { UsernameGeneratorService } from '../../person/domain/username-generator.service.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { EventService } from '../../../core/eventbus/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { EmailAddressNotFoundError } from '../error/email-address-not-found.error.js';
import { EmailAddressEntity } from './email-address.entity.js';
import { Person } from '../../person/domain/person.js';
import { DomainError } from '../../../shared/error/index.js';
import { MikroORM, RequiredEntityData } from '@mikro-orm/core';
import { EmailAddress, EmailAddressStatus } from '../domain/email-address.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { mapAggregateToData } from './email.repo.js';
import { PersonAlreadyHasEnabledEmailAddressError } from '../error/person-already-has-enabled-email-address.error.js';
import { UserLockRepository } from '../../keycloak-administration/repository/user-lock.repository.js';
import { PersonEmailResponse } from '../../person/api/person-email-response.js';

describe('EmailRepo', () => {
    let module: TestingModule;
    let sut: EmailRepo;
    let emailFactory: EmailFactory;
    let personFactory: PersonFactory;
    let personRepository: PersonRepository;
    let organisationRepository: OrganisationRepository;
    let orm: MikroORM;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true })],
            providers: [
                UsernameGeneratorService,
                EmailRepo,
                EmailFactory,
                PersonFactory,
                PersonRepository,
                OrganisationRepository,
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>({
                        create: () =>
                            Promise.resolve({
                                ok: true,
                                value: faker.string.uuid(),
                            }),
                        setPassword: () =>
                            Promise.resolve({
                                ok: true,
                                value: faker.string.alphanumeric(16),
                            }),
                    }),
                },
                {
                    provide: UserLockRepository,
                    useValue: createMock<UserLockRepository>(),
                },
            ],
        }).compile();
        sut = module.get(EmailRepo);
        emailFactory = module.get(EmailFactory);
        personFactory = module.get(PersonFactory);
        personRepository = module.get(PersonRepository);
        organisationRepository = module.get(OrganisationRepository);
        orm = module.get(MikroORM);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    async function createPerson(): Promise<Person<true>> {
        const personResult: Person<false> | DomainError = await personFactory.createNew({
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            username: faker.internet.userName(),
            password: faker.string.alphanumeric(8),
        });
        if (personResult instanceof DomainError) {
            throw personResult;
        }
        const person: Person<true> | DomainError = await personRepository.create(personResult);
        if (person instanceof DomainError) {
            throw person;
        }

        return person;
    }

    async function createOrganisation(): Promise<Organisation<true>> {
        const parent: Organisation<false> = DoFactory.createOrganisation(false, {
            emailDomain: 'fake@schule-sh.de',
        });
        const parentPersisted: Organisation<true> = await organisationRepository.save(parent);
        const organisation: Organisation<false> = DoFactory.createOrganisation(false, {
            administriertVon: parentPersisted.id,
            emailDomain: 'fake@fake-schule.de',
        });
        return organisationRepository.save(organisation);
    }

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('findEnabledByPerson', () => {
        describe('when email-address is found for personId', () => {
            it('should return email with email-addresses by personId', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();

                email.value.enable();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const foundEmail: Option<EmailAddress<true>> = await sut.findEnabledByPerson(person.id);
                if (!foundEmail) throw Error();

                expect(foundEmail).toBeTruthy();
            });
        });

        describe('when person does NOT exist', () => {
            it('should return undefined', async () => {
                const foundEmail: Option<EmailAddress<true>> = await sut.findEnabledByPerson(faker.string.uuid());

                expect(foundEmail).toBeUndefined();
            });
        });
    });

    describe('findRequestedByPerson', () => {
        describe('when email-address is found for personId', () => {
            it('should return email with email-addresses by personId', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();

                email.value.request();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const foundEmail: Option<EmailAddress<true>> = await sut.findRequestedByPerson(person.id);
                if (!foundEmail) throw Error();

                expect(foundEmail).toBeTruthy();
            });
        });

        describe('when person does NOT exist', () => {
            it('should return undefined', async () => {
                const foundEmail: Option<EmailAddress<true>> = await sut.findRequestedByPerson(faker.string.uuid());

                expect(foundEmail).toBeUndefined();
            });
        });
    });

    describe('findByPerson', () => {
        describe('when no status is provided and email-address is found for personId', () => {
            it('should return email with email-addresses by personId', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();

                email.value.request();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const foundEmails: Option<EmailAddress<true>[]> = await sut.findByPersonSortedByUpdatedAtDesc(
                    person.id,
                );
                if (!foundEmails) throw Error();

                expect(foundEmails).toBeTruthy();
                expect(foundEmails).toHaveLength(1);
            });
        });

        describe('when no status is provided and person does NOT exist', () => {
            it('should return undefined', async () => {
                const foundEmails: Option<EmailAddress<true>[]> = await sut.findByPersonSortedByUpdatedAtDesc(
                    faker.string.uuid(),
                );

                expect(foundEmails).toBeUndefined();
            });
        });

        describe('when ENABLED status is provided but only requested email-address is found for personId', () => {
            it('should return undefined', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();

                email.value.request();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const foundEmails: Option<EmailAddress<true>[]> = await sut.findByPersonSortedByUpdatedAtDesc(
                    person.id,
                    EmailAddressStatus.ENABLED,
                );

                expect(foundEmails).toBeUndefined();
            });
        });

        describe('when ENABLED status is provided and email-address is found for personId', () => {
            it('should return undefined', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();

                email.value.enable();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const foundEmails: Option<EmailAddress<true>[]> = await sut.findByPersonSortedByUpdatedAtDesc(
                    person.id,
                    EmailAddressStatus.ENABLED,
                );
                if (!foundEmails) throw Error();

                expect(foundEmails).toBeDefined();
                expect(foundEmails).toHaveLength(1);
            });
        });

        describe('when status is provided and person does NOT exist', () => {
            it('should return undefined', async () => {
                const foundEmails: Option<EmailAddress<true>[]> = await sut.findByPersonSortedByUpdatedAtDesc(
                    faker.string.uuid(),
                    EmailAddressStatus.ENABLED,
                );

                expect(foundEmails).toBeUndefined();
            });
        });
    });

    describe('getEmailAddressAndStatusForPerson', () => {
        describe('when person has NO email-address assigned', () => {
            it('should return undefined', async () => {
                const person: Person<true> = await createPerson();

                const personEmailResponse: Option<PersonEmailResponse> =
                    await sut.getEmailAddressAndStatusForPerson(person);

                expect(personEmailResponse).toBeUndefined();
            });
        });

        describe('when person has enabled email-address assigned', () => {
            it('should return enabled address', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const emailRequested: Result<EmailAddress<false>> = await emailFactory.createNew(
                    person.id,
                    organisation.id,
                );
                if (!emailRequested.ok) throw new Error();
                emailRequested.value.request();
                const savedRequestedEmail: EmailAddress<true> | DomainError = await sut.save(emailRequested.value);
                if (savedRequestedEmail instanceof DomainError) throw new Error();

                const emailEnabled: Result<EmailAddress<false>> = await emailFactory.createNew(
                    person.id,
                    organisation.id,
                );
                if (!emailEnabled.ok) throw new Error();
                emailEnabled.value.enable();
                const savedEnabledEmail: EmailAddress<true> | DomainError = await sut.save(emailEnabled.value);
                if (savedEnabledEmail instanceof DomainError) throw new Error();

                const personEmailResponse: Option<PersonEmailResponse> =
                    await sut.getEmailAddressAndStatusForPerson(person);

                if (!personEmailResponse) throw Error();

                expect(personEmailResponse.status).toStrictEqual(EmailAddressStatus.ENABLED);
                expect(personEmailResponse.address).toStrictEqual(emailEnabled.value.address);
            });
        });

        describe('when person has no enabled email-address assigned', () => {
            it('should return the most recently updated one', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const emailRequested: Result<EmailAddress<false>> = await emailFactory.createNew(
                    person.id,
                    organisation.id,
                );
                if (!emailRequested.ok) throw new Error();
                emailRequested.value.request();
                const savedRequestedEmail: EmailAddress<true> | DomainError = await sut.save(emailRequested.value);
                if (savedRequestedEmail instanceof DomainError) throw new Error();

                const emailFailed: Result<EmailAddress<false>> = await emailFactory.createNew(
                    person.id,
                    organisation.id,
                );
                if (!emailFailed.ok) throw new Error();
                emailFailed.value.failed();
                const savedFailedEmail: EmailAddress<true> | DomainError = await sut.save(emailFailed.value);
                if (savedFailedEmail instanceof DomainError) throw new Error();

                const personEmailResponse: Option<PersonEmailResponse> =
                    await sut.getEmailAddressAndStatusForPerson(person);

                if (!personEmailResponse) throw Error();

                expect(personEmailResponse.status).toStrictEqual(EmailAddressStatus.FAILED);
                expect(personEmailResponse.address).toStrictEqual(emailFailed.value.address);
            });
        });
    });

    describe('deactivateEmailAddress', () => {
        describe('when email-address exists', () => {
            it('should disable it and return EmailAddressEntity', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                await organisationRepository.save(organisation);
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw new Error();
                email.value.enable();

                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const currentAddress: Option<string> = savedEmail.currentAddress;
                if (!currentAddress) throw new Error();
                const deactivationResult: EmailAddressEntity | EmailAddressNotFoundError =
                    await sut.deactivateEmailAddress(currentAddress);

                expect(deactivationResult).toBeInstanceOf(EmailAddressEntity);
            });
        });

        describe('when email-address does NOT exist', () => {
            it('should return EmailAddressNotFoundError', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw Error();
                email.value.enable();
                const savedEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (savedEmail instanceof DomainError) throw new Error();
                const deactivationResult: EmailAddressEntity | EmailAddressNotFoundError =
                    await sut.deactivateEmailAddress(faker.internet.email());

                expect(deactivationResult).toBeInstanceOf(EmailAddressNotFoundError);
            });
        });
    });

    describe('save', () => {
        describe('when address is already persisted', () => {
            it('should use update method and return EmailAddress aggregate', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw Error();
                email.value.enable();
                const persistedValidEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (persistedValidEmail instanceof DomainError) throw new Error();

                persistedValidEmail.disable();
                const persistedDisabledEmail: EmailAddress<true> | DomainError = await sut.save(persistedValidEmail);

                expect(persistedDisabledEmail).toBeInstanceOf(EmailAddress);
            });
        });

        describe('when address is already persisted BUT cannot be found in DB', () => {
            it('should return EmailAddressNotFoundError', async () => {
                const person: Person<true> = await createPerson();
                const emailAddress: EmailAddress<true> = emailFactory.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    person.id,
                    faker.internet.email(),
                    EmailAddressStatus.ENABLED,
                );

                const persistenceResult: EmailAddress<true> | DomainError = await sut.save(emailAddress);

                expect(persistenceResult).toBeInstanceOf(EmailAddressNotFoundError);
            });
        });

        describe('when address with status ENABLED is already present for person', () => {
            it('should return PersonAlreadyHasEnabledEmailAddressError', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await createOrganisation();
                const email: Result<EmailAddress<false>> = await emailFactory.createNew(person.id, organisation.id);
                if (!email.ok) throw Error();
                email.value.enable();
                const persistedValidEmail: EmailAddress<true> | DomainError = await sut.save(email.value);
                if (persistedValidEmail instanceof DomainError) throw new Error();

                const person2: Person<true> = await createPerson();
                const email2: Result<EmailAddress<false>> = await emailFactory.createNew(person2.id, organisation.id);
                if (!email2.ok) throw Error();
                email2.value.enable();
                const persistedValidEmail2: EmailAddress<true> | DomainError = await sut.save(email.value);

                const error: PersonAlreadyHasEnabledEmailAddressError = new PersonAlreadyHasEnabledEmailAddressError(
                    person.id,
                    email.value.address,
                );
                expect(persistedValidEmail2).toEqual(error);
            });
        });
    });

    describe('mapAggregateToData', () => {
        const expectedProperties: string[] = ['id', 'personId', 'address', 'oxUserId', 'status'];

        describe('when oxUserId is provided', () => {
            it('should return EmailAddress RequiredEntityData', () => {
                const person: EmailAddress<true> = EmailAddress.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.string.uuid(),
                    faker.internet.email(),
                    faker.helpers.enumValue(EmailAddressStatus),
                    faker.string.numeric(),
                );

                const result: RequiredEntityData<EmailAddressEntity> = mapAggregateToData(person);

                expectedProperties.forEach((prop: string) => {
                    expect(result).toHaveProperty(prop);
                });
            });
        });

        describe('when oxUserId is NOT provided', () => {
            it('should return EmailAddress RequiredEntityData', () => {
                const person: EmailAddress<true> = EmailAddress.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.string.uuid(),
                    faker.internet.email(),
                    faker.helpers.enumValue(EmailAddressStatus),
                );

                const result: RequiredEntityData<EmailAddressEntity> = mapAggregateToData(person);

                expectedProperties.forEach((prop: string) => {
                    expect(result).toHaveProperty(prop);
                });
            });
        });
    });
});
