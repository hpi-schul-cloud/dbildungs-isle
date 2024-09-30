import { faker } from '@faker-js/faker';
import { Collection, EntityManager, MikroORM, rel, RequiredEntityData } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { PersonEntity } from './person.entity.js';
import {
    getEnabledEmailAddress,
    mapAggregateToData,
    mapEntityToAggregate,
    mapEntityToAggregateInplace,
    PersonRepository,
} from './person.repository.js';
import { Person } from '../domain/person.js';
import { PersonScope } from './person.scope.js';
import { ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { UsernameGeneratorService } from '../domain/username-generator.service.js';
import { KeycloakUserService, PersonHasNoKeycloakId } from '../../keycloak-administration/index.js';
import {
    DomainError,
    EntityCouldNotBeDeleted,
    EntityNotFoundError,
    KeycloakClientError,
    MismatchedRevisionError,
    MissingPermissionsError,
} from '../../../shared/error/index.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { ConfigService } from '@nestjs/config';
import { EventService } from '../../../core/eventbus/index.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { EmailAddressEntity } from '../../email/persistence/email-address.entity.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { RollenArt, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { PersonenkontextEntity } from '../../personenkontext/persistence/personenkontext.entity.js';
import { createAndPersistOrganisation } from '../../../../test/utils/organisation-test-helper.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { OrganisationEntity } from '../../organisation/persistence/organisation.entity.js';
import { RolleEntity } from '../../rolle/entity/rolle.entity.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';
import { RolleFactory } from '../../rolle/domain/rolle.factory.js';
import { PersonenkontextFactory } from '../../personenkontext/domain/personenkontext.factory.js';
import { DBiamPersonenkontextRepoInternal } from '../../personenkontext/persistence/internal-dbiam-personenkontext.repo.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { Rolle as SchulConnexRolle } from '../../personenkontext/domain/personenkontext.enums.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { PersonalnummerUpdateOutdatedError } from '../domain/update-outdated.error.js';
import { PersonalnummerRequiredError } from '../domain/personalnummer-required.error.js';

describe('PersonRepository Integration', () => {
    let module: TestingModule;
    let sut: PersonRepository;
    let orm: MikroORM;
    let em: EntityManager;
    let kcUserServiceMock: DeepMocked<KeycloakUserService>;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;
    let personPermissionsMock: DeepMocked<PersonPermissions>;
    let eventServiceMock: DeepMocked<EventService>;
    let rolleFactory: RolleFactory;
    let rolleRepo: RolleRepo;
    let dbiamPersonenkontextRepoInternal: DBiamPersonenkontextRepoInternal;
    let personenkontextFactory: PersonenkontextFactory;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [
                PersonRepository,
                ConfigService,
                {
                    provide: EmailRepo,
                    useValue: createMock<EmailRepo>(),
                },
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                // the following are required to prepare the test for findByIds()
                OrganisationRepository,
                ServiceProviderRepo,
                RolleFactory,
                RolleRepo,
                DBiamPersonenkontextRepoInternal,
                PersonenkontextFactory,
            ],
        }).compile();
        sut = module.get(PersonRepository);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        personPermissionsMock = createMock<PersonPermissions>();

        kcUserServiceMock = module.get(KeycloakUserService);
        usernameGeneratorService = module.get(UsernameGeneratorService);
        eventServiceMock = module.get(EventService);
        rolleFactory = module.get(RolleFactory);
        rolleRepo = module.get(RolleRepo);
        dbiamPersonenkontextRepoInternal = module.get(DBiamPersonenkontextRepoInternal);
        personenkontextFactory = module.get(PersonenkontextFactory);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    type SavedPersonProps = { keycloackID: string };
    async function savePerson(
        withPersonalnummer: boolean = false,
        props: Partial<SavedPersonProps> = {},
    ): Promise<Person<true>> {
        usernameGeneratorService.generateUsername.mockResolvedValueOnce({ ok: true, value: 'testusername' });
        const defaultProps: SavedPersonProps = {
            keycloackID: faker.string.uuid(),
        };

        const personProps: {
            keycloackID: string;
        } = { ...defaultProps, ...props };
        const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
            familienname: faker.person.lastName(),
            vorname: faker.person.firstName(),
            referrer: faker.string.alphanumeric(5),
            personalnummer: withPersonalnummer ? faker.finance.pin(7) : undefined,
        });

        if (person instanceof DomainError) {
            throw person;
        }

        kcUserServiceMock.create.mockResolvedValueOnce({
            ok: true,
            value: personProps.keycloackID,
        });
        kcUserServiceMock.setPassword.mockResolvedValueOnce({
            ok: true,
            value: '',
        });
        const savedPerson: Person<true> | DomainError = await sut.save(person);

        if (savedPerson instanceof DomainError) {
            throw savedPerson;
        } else {
            return savedPerson;
        }
    }

    describe('findByKeycloakUserId', () => {
        describe('when found by keycloakUserId', () => {
            it('should return found person', async () => {
                const personSaved: Person<true> = await savePerson();
                if (personSaved.keycloakUserId) {
                    const foundPerson: Option<Person<true>> = await sut.findByKeycloakUserId(
                        personSaved.keycloakUserId,
                    );
                    expect(foundPerson).toBeInstanceOf(Person);
                } else {
                    throw new Error();
                }
            });
        });

        describe('when not found by keycloakUserId', () => {
            it('should return null', async () => {
                const foundPerson: Option<Person<true>> = await sut.findByKeycloakUserId(faker.string.uuid());

                expect(foundPerson).toBeNull();
            });
        });
    });

    describe('findByUsername', () => {
        describe('when found by username', () => {
            it('should return found person', async () => {
                const personSaved: Person<true> = await savePerson();
                if (personSaved.referrer) {
                    const foundPerson: Option<Person<true>> = await sut.findByUsername(personSaved.referrer);
                    expect(foundPerson).toBeInstanceOf(Person);
                } else {
                    throw new Error();
                }
            });
        });

        describe('when not found by keycloakUserId', () => {
            it('should return null', async () => {
                const foundPerson: Option<Person<true>> = await sut.findByUsername(faker.string.uuid());

                expect(foundPerson).toBeNull();
            });
        });
    });

    describe('findById', () => {
        describe('when found by Id', () => {
            it('should return found person', async () => {
                const nokeyclockID: SavedPersonProps = { keycloackID: '' };

                const personSaved: Person<true> = await savePerson(false, nokeyclockID);

                const foundPerson: Option<Person<true>> = await sut.findById(personSaved.id);

                expect(foundPerson).toBeInstanceOf(Person);
            });
        });

        describe('when not found by Id', () => {
            it('should return null', async () => {
                const foundPerson: Option<Person<true>> = await sut.findById(faker.string.uuid());

                expect(foundPerson).toBeNull();
            });
        });

        describe('findBy', () => {
            it('should return found persons for scope', async () => {
                await savePerson();
                await savePerson();

                const scope: PersonScope = new PersonScope()
                    .findBy({
                        vorname: undefined,
                        familienname: undefined,
                        geburtsdatum: undefined,
                    })
                    .sortBy('vorname', ScopeOrder.ASC)
                    .paged(0, 2);

                const [persons, total]: Counted<Person<true>> = await sut.findBy(scope);

                expect(total).toEqual(2);
                expect(persons.at(0)).toBeInstanceOf(Person);
                expect(persons.at(1)).toBeInstanceOf(Person);
            });
        });
    });

    describe('create', () => {
        describe('When Normal Call Without Hashed Password', () => {
            describe('when person has already keycloak user', () => {
                it('should return Domain Error', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    person.keycloakUserId = faker.string.uuid();
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(person);

                    expect(result).toBeInstanceOf(DomainError);
                    expect(kcUserServiceMock.create).not.toHaveBeenCalled();
                });
            });

            describe('when parameters (username || password) is missing', () => {
                it('should return Domain Error', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    person.username = undefined;
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(person);

                    expect(result).toBeInstanceOf(DomainError);
                    expect(kcUserServiceMock.create).not.toHaveBeenCalled();
                });
            });

            describe('when successful', () => {
                it('should return Person', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: 'testusername' });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    const personWithKeycloak: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        {
                            familienname: faker.person.lastName(),
                            vorname: faker.person.firstName(),
                        },
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    expect(personWithKeycloak).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError || personWithKeycloak instanceof DomainError) {
                        return;
                    }

                    personWithKeycloak.keycloakUserId = faker.string.uuid();
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(person);

                    expect(result).toBeInstanceOf(Person);
                });
            });

            describe('when creation of keyCloakUser fails', () => {
                it('should return Domain Error', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: false,
                        error: new KeycloakClientError(''),
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(person);

                    expect(result).toBeInstanceOf(DomainError);
                    if (result instanceof DomainError) {
                        expect(kcUserServiceMock.setPassword).not.toHaveBeenCalled();
                        expect(kcUserServiceMock.delete).not.toHaveBeenCalled();
                    }
                });
            });

            describe('when resetting password of keycloak user fails', () => {
                it('should return Domain Error && delete keycloak user', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: false,
                        error: new KeycloakClientError(''),
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(person);

                    expect(result).toBeInstanceOf(DomainError);
                    if (result instanceof DomainError) {
                        expect(kcUserServiceMock.setPassword).toHaveBeenCalled();
                        expect(kcUserServiceMock.delete).toHaveBeenCalled();
                    }
                });
            });
            describe('when creating a person with an existing personalnummer', () => {
                it('should return DuplicatePersonalnummerError and rollback the transaction', async () => {
                    const existingPersonalnummer: string = '123456';
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                        personalnummer: existingPersonalnummer, // Setting the personalnummer to check for duplicates
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    const personEntity: PersonEntity = em.create(PersonEntity, mapAggregateToData(person));

                    personEntity.keycloakUserId = faker.string.numeric();

                    // Persist a person with the same Personalnummer as the one we send later
                    await em.persistAndFlush(personEntity);

                    // Act: Attempt to create the person
                    const result: Person<true> | DomainError = await sut.create(person);

                    // Assert: Ensure that a DuplicatePersonalnummerError was thrown and the transaction was rolled back
                    expect(result).toBeInstanceOf(DuplicatePersonalnummerError);
                });
            });
        });
        describe('When Migration Call With Hashed Password', () => {
            describe('when successful', () => {
                it('should return Person', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: 'testusername' });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    const personWithKeycloak: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        {
                            familienname: faker.person.lastName(),
                            vorname: faker.person.firstName(),
                        },
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    expect(personWithKeycloak).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError || personWithKeycloak instanceof DomainError) {
                        return;
                    }

                    personWithKeycloak.keycloakUserId = faker.string.uuid();
                    kcUserServiceMock.createWithHashedPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(
                        person,
                        '{BCRYPT}xxxxxhqG5T3$z8v0Ou8Lmmr2mhW.lNP0DQGO9M',
                    );

                    expect(result).toBeInstanceOf(Person);
                });
            });
            describe('when username & keycloakUserId is missing', () => {
                it('should return Error', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: 'testusername' });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    const personWithKeycloak: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        {
                            familienname: faker.person.lastName(),
                            vorname: faker.person.firstName(),
                        },
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    expect(personWithKeycloak).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError || personWithKeycloak instanceof DomainError) {
                        return;
                    }

                    person.keycloakUserId = undefined;
                    person.username = undefined;
                    kcUserServiceMock.createWithHashedPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(
                        person,
                        '{BCRYPT}xxxxxhqG5T3$z8v0Ou8Lmmr2mhW.lNP0DQGO9M',
                    );

                    expect(result).toBeInstanceOf(DomainError);
                });
            });
            describe('when createWithHashedPassword Keycloak Userservice fails', () => {
                it('should return Error', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: 'testusername' });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    const personWithKeycloak: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        {
                            familienname: faker.person.lastName(),
                            vorname: faker.person.firstName(),
                        },
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    expect(personWithKeycloak).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError || personWithKeycloak instanceof DomainError) {
                        return;
                    }

                    personWithKeycloak.keycloakUserId = faker.string.uuid();
                    kcUserServiceMock.createWithHashedPassword.mockResolvedValueOnce({
                        ok: false,
                        error: new KeycloakClientError(''),
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const result: Person<true> | DomainError = await sut.create(
                        person,
                        '{BCRYPT}xxxxxhqG5T3$z8v0Ou8Lmmr2mhW.lNP0DQGO9M',
                    );

                    expect(result).toBeInstanceOf(DomainError);
                });
            });
        });

        describe('When an unexpected error occurs', () => {
            it('should rollback transaction and rethrow', async () => {
                usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: 'testusername' });
                const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                });
                if (person instanceof DomainError) {
                    throw person;
                }

                const dummyError: Error = new Error('Unexpected');
                kcUserServiceMock.create.mockRejectedValueOnce(dummyError);

                const promise: Promise<unknown> = sut.create(person);

                await expect(promise).rejects.toBe(dummyError);
            });
        });
    });

    describe('update', () => {
        describe('when person exist', () => {
            describe('when only updating database attributes', () => {
                it('should return updated person', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    person.username = undefined;
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const existingPerson: Person<true> | DomainError = await sut.create(person);
                    if (existingPerson instanceof DomainError) {
                        return;
                    }
                    const personConstructed: Person<true> = Person.construct(
                        existingPerson.id,
                        faker.date.past(),
                        faker.date.recent(),
                        faker.person.lastName(),
                        faker.person.firstName(),
                        '1',
                        faker.lorem.word(),
                        faker.lorem.word(),
                        faker.string.uuid(),
                    );
                    await expect(sut.update(personConstructed)).resolves.toBeInstanceOf(Person<true>);
                    const result: Person<true> | DomainError = await sut.update(personConstructed);
                    expect(result).not.toBeInstanceOf(DomainError);
                    if (result instanceof DomainError) {
                        return;
                    }
                    expect(result.vorname).toEqual(person.vorname);
                    expect(result.familienname).toEqual(person.familienname);
                    expect(kcUserServiceMock.setPassword).not.toHaveBeenCalled();
                });
            });

            describe('when lastname has changed', () => {
                it('should trigger PersonRenamedEvent', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });
                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    person.username = 'name';
                    //person.keycloakUserId = faker.string.uuid();
                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    kcUserServiceMock.delete.mockResolvedValueOnce({
                        ok: true,
                        value: undefined,
                    });
                    const existingPerson: Person<true> | DomainError = await sut.create(person);
                    if (existingPerson instanceof DomainError) {
                        return;
                    }
                    const personConstructed: Person<true> = Person.construct(
                        existingPerson.id,
                        faker.date.past(),
                        faker.date.recent(),
                        faker.person.lastName(),
                        person.vorname,
                        '1',
                        faker.lorem.word(),
                        faker.lorem.word(),
                        faker.string.uuid(),
                    );
                    await expect(sut.update(personConstructed)).resolves.toBeInstanceOf(Person<true>);
                    const result: Person<true> | DomainError = await sut.update(personConstructed);
                    expect(result).not.toBeInstanceOf(DomainError);
                    if (result instanceof DomainError) {
                        return;
                    }
                    expect(eventServiceMock.publish).toHaveBeenCalledWith(expect.any(PersonRenamedEvent));
                    expect(result.vorname).toEqual(person.vorname);
                    expect(result.familienname).not.toEqual(person.familienname);
                });
            });

            describe('when updating keycloak password', () => {
                describe('when keycloak operation succeeds', () => {
                    it('should return updated person', async () => {
                        usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                            ok: true,
                            value: 'testusername',
                        });
                        const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                            familienname: faker.person.lastName(),
                            vorname: faker.person.firstName(),
                        });
                        expect(person).not.toBeInstanceOf(DomainError);
                        if (person instanceof DomainError) {
                            return;
                        }
                        person.username = undefined;
                        kcUserServiceMock.create.mockResolvedValueOnce({
                            ok: true,
                            value: '',
                        });
                        kcUserServiceMock.setPassword.mockResolvedValueOnce({
                            ok: true,
                            value: '',
                        });
                        kcUserServiceMock.delete.mockResolvedValueOnce({
                            ok: true,
                            value: undefined,
                        });
                        const existingPerson: Person<true> | DomainError = await sut.create(person);
                        if (existingPerson instanceof DomainError) {
                            return;
                        }
                        const personConstructed: Person<true> = Person.construct(
                            existingPerson.id,
                            faker.date.past(),
                            faker.date.recent(),
                            faker.person.lastName(),
                            faker.person.firstName(),
                            '1',
                            faker.lorem.word(),
                            faker.lorem.word(),
                            faker.string.uuid(),
                        );
                        person.resetPassword();

                        kcUserServiceMock.setPassword.mockResolvedValue({
                            ok: true,
                            value: '',
                        });

                        await expect(sut.update(personConstructed)).resolves.toBeInstanceOf(Person<true>);
                        const result: Person<true> | DomainError = await sut.update(personConstructed);
                        expect(result).not.toBeInstanceOf(DomainError);
                        if (result instanceof DomainError) {
                            return;
                        }
                        expect(result.vorname).toEqual(person.vorname);
                        expect(result.familienname).toEqual(person.familienname);
                        expect(kcUserServiceMock.setPassword).toHaveBeenCalled();
                    });
                });
                describe('when keycloak operation fails', () => {
                    it('should return updated person', async () => {
                        const PersonSaved: Person<true> = await savePerson();
                        const person: Person<true> = Person.construct(
                            PersonSaved.id,
                            faker.date.past(),
                            faker.date.recent(),
                            faker.person.lastName(),
                            faker.person.firstName(),
                            '1',
                            faker.lorem.word(),
                            faker.lorem.word(),
                            faker.string.uuid(),
                        );
                        person.resetPassword();

                        kcUserServiceMock.setPassword.mockResolvedValue({
                            ok: false,
                            error: new KeycloakClientError(''),
                        });

                        await expect(sut.update(person)).resolves.toBeInstanceOf(DomainError);
                        const result: Person<true> | DomainError = await sut.update(person);
                        expect(result).not.toBeInstanceOf(Person<true>);
                        if (result instanceof Person) {
                            return;
                        }
                        expect(kcUserServiceMock.setPassword).toHaveBeenCalled();
                    });
                });
            });
        });
        describe('when person does not exist', () => {
            it('should fail', async () => {
                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.person.lastName(),
                    faker.person.firstName(),
                    '1',
                    faker.lorem.word(),
                    faker.lorem.word(),
                    faker.string.uuid(),
                );
                await expect(sut.update(person)).rejects.toBeDefined();
            });
        });
    });

    describe('getEnabledEmailAddress', () => {
        let personEntity: PersonEntity;

        beforeEach(() => {
            personEntity = em.create(
                PersonEntity,
                mapAggregateToData(DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() })),
            );
            personEntity.emailAddresses = new Collection<EmailAddressEntity>(personEntity);
        });

        describe('when enabled emailAddress is in collection', () => {
            it('should return address of (first found) enabled address', () => {
                const emailAddressEntity: EmailAddressEntity = new EmailAddressEntity();
                emailAddressEntity.status = EmailAddressStatus.ENABLED;
                emailAddressEntity.address = faker.internet.email();
                personEntity.emailAddresses.add(emailAddressEntity);

                const result: string | undefined = getEnabledEmailAddress(personEntity);

                expect(result).toBeDefined();
            });
        });

        describe('when NO enabled emailAddress is in collection', () => {
            it('should return undefined', () => {
                const emailAddressEntity: EmailAddressEntity = new EmailAddressEntity();
                emailAddressEntity.status = EmailAddressStatus.DISABLED;
                emailAddressEntity.address = faker.internet.email();
                personEntity.emailAddresses.add(emailAddressEntity);

                const result: string | undefined = getEnabledEmailAddress(personEntity);

                expect(result).toBeUndefined();
            });
        });

        describe('when NO emailAddress at all is found in collection', () => {
            it('should return undefined', () => {
                const result: string | undefined = getEnabledEmailAddress(personEntity);

                expect(result).toBeUndefined();
            });
        });
    });

    describe('mapAggregateToData', () => {
        it('should return Person RequiredEntityData', () => {
            const person: Person<true> = Person.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.person.lastName(),
                faker.person.firstName(),
                '1',
                faker.lorem.word(),
                faker.lorem.word(),
                faker.string.uuid(),
            );

            const expectedProperties: string[] = [
                'keycloakUserId',
                'referrer',
                'mandant',
                'stammorganisation',
                'familienname',
                'vorname',
                'initialenFamilienname',
                'initialenVorname',
                'rufname',
                'nameTitel',
                'nameAnrede',
                'namePraefix',
                'nameSuffix',
                'nameSortierindex',
                'geburtsdatum',
                'geburtsort',
                'geschlecht',
                'lokalisierung',
                'vertrauensstufe',
                'auskunftssperre',
                'dataProvider',
                'revision',
            ];

            const result: RequiredEntityData<PersonEntity> = mapAggregateToData(person);

            expectedProperties.forEach((prop: string) => {
                expect(result).toHaveProperty(prop);
            });
        });
    });

    describe('mapEntityToAggregate', () => {
        it('should return New Aggregate', () => {
            const personEntity: PersonEntity = em.create(
                PersonEntity,
                mapAggregateToData(DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() })),
            );
            const person: Person<true> = mapEntityToAggregate(personEntity);

            expect(person).toBeInstanceOf(Person);
        });
    });

    describe('mapEntityToAggregateInplace', () => {
        it('should return Updated Aggregate', () => {
            const person: Person<true> = Person.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.person.lastName(),
                faker.person.firstName(),
                '1',
                faker.lorem.word(),
                faker.lorem.word(),
                faker.string.uuid(),
            );

            const personEntity: PersonEntity = createMock<PersonEntity>(
                DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() }),
            );
            const personAfterUpdate: Person<true> = mapEntityToAggregateInplace(personEntity, person);

            expect(personAfterUpdate).toBeInstanceOf(Person);
            expect(personAfterUpdate.vorname).toEqual(person.vorname);
            expect(personAfterUpdate.familienname).toEqual(person.familienname);
        });
    });
    describe('getPersonIfAllowed', () => {
        describe('when person is found on any same organisations like the affected person', () => {
            it('should return person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;

                const organisation: OrganisationEntity = await createAndPersistOrganisation(
                    em,
                    undefined,
                    OrganisationsTyp.SCHULE,
                );

                const rolleData: RequiredEntityData<RolleEntity> = {
                    name: 'Testrolle',
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.ORGADMIN,
                    istTechnisch: false,
                };
                const rolleEntity: RolleEntity = em.create(RolleEntity, rolleData);
                await em.persistAndFlush(rolleEntity);

                const personenkontextData: RequiredEntityData<PersonenkontextEntity> = {
                    organisationId: organisation.id,
                    personId: person1.id,
                    rolleId: rolleEntity.id,
                    rolle: SchulConnexRolle.LEHRENDER,
                };
                const personenkontextEntity: PersonenkontextEntity = em.create(
                    PersonenkontextEntity,
                    personenkontextData,
                );
                await em.persistAndFlush(personenkontextEntity);

                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                    all: false,
                    orgaIds: [organisation.id],
                });

                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId!,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                const result: Result<Person<true>> = await sut.getPersonIfAllowed(person1.id, personPermissionsMock);

                expect(result.ok).toBeTruthy();
            });
            it('should return person with fallback keycloak info', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                    all: true,
                });
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;
                person1.lockInfo = { lock_locked_from: '', lock_timestamp: '' };
                person1.isLocked = false;

                kcUserServiceMock.findById.mockResolvedValue({
                    ok: false,
                    error: new KeycloakClientError(''),
                });

                const result: Result<Person<true>> = await sut.getPersonIfAllowed(person1.id, personPermissionsMock);

                expect(result.ok).toBeTruthy();
            });
        });
        describe('when user has permission on root organisation', () => {
            it('should return person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);

                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce({ all: true });
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId!,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                const result: Result<Person<true>> = await sut.getPersonIfAllowed(
                    personEntity.id,
                    personPermissionsMock,
                );

                expect(result.ok).toBeTruthy();
            });
        });
    });
    describe('deletePerson', () => {
        describe('Delete the person and all kontexte', () => {
            afterEach(() => {
                personPermissionsMock.getOrgIdsWithSystemrecht.mockReset();
            });

            it('should delete the person as root', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;
                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId!,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );
                expect(result.ok).toBeTruthy();
            });

            it('should delete the person as admin of organisation', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;
                const organisation: OrganisationEntity = await createAndPersistOrganisation(
                    em,
                    undefined,
                    OrganisationsTyp.SCHULE,
                );

                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId!,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                const rolleData: RequiredEntityData<RolleEntity> = {
                    name: 'Testrolle',
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.ORGADMIN,
                    istTechnisch: false,
                };

                const rolleEntity: RolleEntity = em.create(RolleEntity, rolleData);
                await em.persistAndFlush(rolleEntity);

                const personenkontextData: RequiredEntityData<PersonenkontextEntity> = {
                    organisationId: organisation.id,
                    personId: person1.id,
                    rolleId: rolleEntity.id,
                    rolle: SchulConnexRolle.LEHRENDER,
                };
                const personenkontextEntity: PersonenkontextEntity = em.create(
                    PersonenkontextEntity,
                    personenkontextData,
                );
                await em.persistAndFlush(personenkontextEntity);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                    all: false,
                    orgaIds: [organisation.id],
                });

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );
                expect(result.ok).toBeTruthy();
            });

            describe('Delete the person and all kontexte and trigger event to delete email', () => {
                it('should delete the person and trigger PersonDeletedEvent', async () => {
                    const person: Person<true> = DoFactory.createPerson(true);
                    const personEntity: PersonEntity = new PersonEntity();
                    await em.persistAndFlush(personEntity.assign(mapAggregateToData(person)));
                    person.id = personEntity.id;
                    personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

                    await em.persistAndFlush(personEntity);

                    const emailAddress: EmailAddressEntity = new EmailAddressEntity();
                    emailAddress.address = faker.internet.email();
                    emailAddress.personId = rel(PersonEntity, person.id);
                    emailAddress.status = EmailAddressStatus.ENABLED;

                    const pp: EmailAddressEntity = em.create(EmailAddressEntity, emailAddress);
                    await em.persistAndFlush(pp);

                    personEntity.emailAddresses.add(emailAddress);
                    await em.persistAndFlush(personEntity);
                    kcUserServiceMock.findById.mockResolvedValue({
                        ok: true,
                        value: {
                            id: person.keycloakUserId!,
                            username: person.username ?? '',
                            enabled: true,
                            email: faker.internet.email(),
                            createdDate: new Date(),
                            externalSystemIDs: {},
                            attributes: {},
                        },
                    });

                    const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                    const result: Result<void, DomainError> = await sut.deletePerson(
                        person.id,
                        personPermissionsMock,
                        removedPersonenkontexts,
                    );

                    expect(eventServiceMock.publish).toHaveBeenCalledWith(
                        expect.objectContaining({
                            emailAddress: emailAddress.address,
                        }),
                    );
                    expect(result.ok).toBeTruthy();
                });
            });

            it('should not delete the person because of unsufficient permissions to find the person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds: [] });

                await em.persistAndFlush(new PersonEntity().assign(mapAggregateToData(person1)));

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );

                expect(result.ok).toBeFalsy();
            });
            it('should not delete the person because of unsufficient permissions to delete the person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockImplementation(
                    (systemRechte: RollenSystemRecht[]) => {
                        if (systemRechte.length === 1 && systemRechte[0] === RollenSystemRecht.PERSONEN_VERWALTEN) {
                            return Promise.resolve({ all: true });
                        }
                        return Promise.resolve({ all: false, orgaIds: [] });
                    },
                );
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;
                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId!,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );

                expect(result.ok).toBeFalsy();
                if (!result.ok) {
                    expect(result.error).toBeInstanceOf(EntityCouldNotBeDeleted);
                }
            });
            it('should not delete the person because it has no keycloakId', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                person1.keycloakUserId = '';
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });
                const personEntity: PersonEntity = new PersonEntity();
                await em.persistAndFlush(personEntity.assign(mapAggregateToData(person1)));
                person1.id = personEntity.id;

                kcUserServiceMock.findById.mockResolvedValue({
                    ok: true,
                    value: {
                        id: person1.keycloakUserId,
                        username: person1.username ?? '',
                        enabled: true,
                        email: faker.internet.email(),
                        createdDate: new Date(),
                        externalSystemIDs: {},
                        attributes: {},
                    },
                });

                await sut.getPersonIfAllowed(person1.id, personPermissionsMock);
                const personGetAllowed: Result<Person<true>> = await sut.getPersonIfAllowed(
                    person1.id,
                    personPermissionsMock,
                );

                if (!personGetAllowed.ok) {
                    throw new EntityNotFoundError('Person', person1.id);
                }

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                await expect(
                    sut.deletePerson(personGetAllowed.value.id, personPermissionsMock, removedPersonenkontexts),
                ).rejects.toThrow(PersonHasNoKeycloakId);
            });
        });
    });
    describe('save', () => {
        describe('when person has an id', () => {
            it('should call the update method and return the updated person', async () => {
                const existingPerson: Person<true> = await savePerson();

                const updatedPerson: Person<true> = Person.construct(
                    existingPerson.id,
                    existingPerson.createdAt,
                    existingPerson.updatedAt,
                    faker.person.lastName(),
                    faker.person.firstName(),
                    existingPerson.mandant,
                    existingPerson.stammorganisation,
                    existingPerson.keycloakUserId,
                    existingPerson.referrer,
                );

                const result: Person<true> | DomainError = await sut.save(updatedPerson);

                if (result instanceof DomainError) {
                    return;
                }
                expect(result.vorname).toEqual(updatedPerson.vorname);
                expect(result.familienname).toEqual(updatedPerson.familienname);
            });

            describe('when person does not have an id', () => {
                it('should call the create method and return the created person', async () => {
                    usernameGeneratorService.generateUsername.mockResolvedValueOnce({
                        ok: true,
                        value: 'testusername',
                    });

                    const person: Person<false> | DomainError = await Person.createNew(usernameGeneratorService, {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    });

                    if (person instanceof DomainError) {
                        throw person;
                    }

                    kcUserServiceMock.create.mockResolvedValueOnce({
                        ok: true,
                        value: 'something',
                    });
                    kcUserServiceMock.setPassword.mockResolvedValueOnce({
                        ok: true,
                        value: '',
                    });
                    const savedPerson: Person<true> | DomainError = await sut.create(person);

                    if (savedPerson instanceof DomainError) {
                        throw savedPerson;
                    } else {
                        expect(savedPerson).toBeDefined();
                        expect(savedPerson.id).toBeDefined();
                    }
                });
            });
        });
    });
    describe('exists', () => {
        it('should return true if person exists', async () => {
            const person: Person<true> = await savePerson();

            const exists: boolean = await sut.exists(person.id);

            expect(exists).toBe(true);
        });

        it('should return false if person does not exist', async () => {
            const nonExistentId: string = faker.string.uuid();

            const exists: boolean = await sut.exists(nonExistentId);

            expect(exists).toBe(false);
        });
    });
    describe('findByIds', () => {
        it('should return a list of persons', async () => {
            const person1: Person<true> = await savePerson();
            const person2: Person<true> = await savePerson();
            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

            const persons: Person<true>[] = await sut.findByIds([person1.id, person2.id], personPermissionsMock);

            expect(persons).toHaveLength(2);
            expect(persons.some((p: Person<true>) => p.id === person1.id)).toBe(true);
            expect(persons.some((p: Person<true>) => p.id === person2.id)).toBe(true);
        });
        it('should return an empty list of persons', async () => {
            const person1: Person<true> = await savePerson();
            const person2: Person<true> = await savePerson();
            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds: [] });

            const persons: Person<true>[] = await sut.findByIds([person1.id, person2.id], personPermissionsMock);

            expect(persons).toHaveLength(0);
        });
        it('should return a list of persons with one person', async () => {
            const person1: Person<true> = await savePerson();
            const person2: Person<true> = await savePerson();

            const rolle: Rolle<false> | DomainError = rolleFactory.createNew(
                faker.string.alpha(5),
                faker.string.uuid(),
                RollenArt.LEHR,
                [],
                [],
                [],
                [],
                false,
            );

            if (rolle instanceof DomainError) {
                return;
            }
            const savedRolle: Rolle<true> = await rolleRepo.save(rolle);

            const savedOrganisation: OrganisationEntity = await createAndPersistOrganisation(
                em,
                faker.string.uuid(),
                OrganisationsTyp.SONSTIGE,
                true,
            );
            await dbiamPersonenkontextRepoInternal.save(
                personenkontextFactory.createNew(person1.id, savedOrganisation.id, savedRolle.id),
            );

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [savedOrganisation.id],
            });

            const persons: Person<true>[] = await sut.findByIds([person1.id, person2.id], personPermissionsMock);

            expect(persons).toHaveLength(1);
            expect(persons[0]?.id).toEqual(person1.id);
        });
    });

    describe('updatePersonalnummer', () => {
        it('should return the updated person', async () => {
            const person: Person<true> = await savePerson(true);
            const newPersonalnummer: string = faker.finance.pin(7);
            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(true);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                newPersonalnummer,
                person.updatedAt,
                person.revision,
                personPermissionsMock,
            );
            if (result instanceof DomainError) {
                throw result;
            }

            expect(person.id).toBe(result.id);
            expect(person.personalnummer).not.toBeNull();
            expect(person.personalnummer).not.toEqual(newPersonalnummer);
            expect(result.personalnummer).toEqual(newPersonalnummer);
        });

        it('should return EntityNotFound when person does not exit', async () => {
            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                faker.string.uuid(),
                faker.finance.pin(7),
                faker.date.anytime(),
                '1',
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return MissingPermissionsError if the admin does not have permissions to update the Personalnummer', async () => {
            const person: Person<true> = await savePerson(true);
            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(false);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                faker.finance.pin(7),
                person.updatedAt,
                person.revision,
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(MissingPermissionsError);
        });

        it('should return PersonalnummerRequiredError when personalnummer was not provided', async () => {
            const person: Person<true> = await savePerson(true);
            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(true);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                '',
                person.updatedAt,
                person.revision,
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(PersonalnummerRequiredError);
        });

        it('should return DuplicatePersonalnummerError when the new personalnummer is already assigned', async () => {
            const person: Person<true> = await savePerson(true);
            const person2: Person<true> = await savePerson(true);
            if (!person2.personalnummer) {
                throw new PersonalnummerRequiredError();
            }

            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(true);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                person2.personalnummer,
                person.updatedAt,
                person.revision,
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(DuplicatePersonalnummerError);
        });

        it('should return PersonalnummerUpdateOutdatedError if there is a newer updated version', async () => {
            const person: Person<true> = await savePerson(true);
            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(true);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                faker.finance.pin(7),
                faker.date.past(),
                person.revision,
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(PersonalnummerUpdateOutdatedError);
        });

        it('should return MismatchedRevisionError if the revision is incorrect', async () => {
            const person: Person<true> = await savePerson(true);
            personPermissionsMock.canModifyPerson.mockResolvedValueOnce(true);

            const result: Person<true> | DomainError = await sut.updatePersonalnummer(
                person.id,
                faker.finance.pin(7),
                person.updatedAt,
                '2',
                personPermissionsMock,
            );

            expect(result).toBeInstanceOf(MismatchedRevisionError);
        });
    });
});
