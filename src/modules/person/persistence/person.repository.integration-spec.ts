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
import { PersonRepo } from './person.repo.js';
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
} from '../../../shared/error/index.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { ConfigService } from '@nestjs/config';
import { DataConfig } from '../../../shared/config/data.config.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { EventService } from '../../../core/eventbus/index.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { EmailAddressEntity } from '../../email/persistence/email-address.entity.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';

describe('PersonRepository Integration', () => {
    let module: TestingModule;
    let sut: PersonRepository;
    let orm: MikroORM;
    let em: EntityManager;
    let kcUserServiceMock: DeepMocked<KeycloakUserService>;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;
    let personPermissionsMock: DeepMocked<PersonPermissions>;
    let configService: ConfigService;
    let eventServiceMock: DeepMocked<EventService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [
                PersonRepo,
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
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
        }).compile();
        sut = module.get(PersonRepository);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        personPermissionsMock = createMock<PersonPermissions>();

        kcUserServiceMock = module.get(KeycloakUserService);
        usernameGeneratorService = module.get(UsernameGeneratorService);
        configService = module.get(ConfigService);
        eventServiceMock = module.get(EventService);

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
    async function savePerson(props: Partial<SavedPersonProps> = {}): Promise<Person<true>> {
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

    describe('findById', () => {
        describe('when found by Id', () => {
            it('should return found person', async () => {
                const nokeyclockID: SavedPersonProps = { keycloackID: '' };

                const personSaved: Person<true> = await savePerson(nokeyclockID);

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
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person1.id]);
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

                await sut.getPersonIfAllowed(person1.id, personPermissionsMock);
                const result: Result<Person<true>> = await sut.getPersonIfAllowed(person1.id, personPermissionsMock);

                expect(result.ok).toBeTruthy();
            });
        });
        describe('when user has permission on root organisation', () => {
            it('should return person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                const fakeOrganisationId: string = configService.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;

                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([fakeOrganisationId]);
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
    describe('checkIfDeleteIsAllowed', () => {
        describe('when person is found on any same organisations like the affected person', () => {
            it('should delete with no error', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person1.id]);
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
                await sut.getPersonIfAllowed(person1.id, personPermissionsMock);
                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );

                expect(result.ok).toBeTruthy();
            });
        });
        describe('when user has no permission on root organisation', () => {
            it('should not delete', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);

                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([]);

                await em.persistAndFlush(new PersonEntity().assign(mapAggregateToData(person1)));

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    person1.id,
                    personPermissionsMock,
                    removedPersonenkontexts,
                );

                expect(result.ok).toBeFalsy();
            });
        });
        it('should return an EntityCouldNotBeDeleted exception', async () => {
            const person1: Person<true> = DoFactory.createPerson(true);

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([]);

            await em.persistAndFlush(new PersonEntity().assign(mapAggregateToData(person1)));

            const result: Result<Person<true>, Error> = await sut.checkIfDeleteIsAllowed(
                person1.id,
                personPermissionsMock,
            );

            if (!result.ok) {
                expect(result.error).toBeInstanceOf(EntityCouldNotBeDeleted);
            }
        });
    });
    describe('deletePerson', () => {
        describe('Delete the person and all kontexte', () => {
            it('should delete the person', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person1.id]);
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
                await sut.getPersonIfAllowed(person1.id, personPermissionsMock);
                const personGetAllowed: Result<Person<true>> = await sut.getPersonIfAllowed(
                    person1.id,
                    personPermissionsMock,
                );
                if (!personGetAllowed.ok) {
                    throw new EntityNotFoundError('Person', person1.id);
                }

                const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                const result: Result<void, DomainError> = await sut.deletePerson(
                    personGetAllowed.value.id,
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
                    personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person.id]);

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

                    await sut.getPersonIfAllowed(person.id, personPermissionsMock);
                    const personGetAllowed: Result<Person<true>> = await sut.getPersonIfAllowed(
                        person.id,
                        personPermissionsMock,
                    );
                    if (!personGetAllowed.ok) {
                        throw new EntityNotFoundError('Person', person.id);
                    }

                    const removedPersonenkontexts: PersonenkontextEventKontextData[] = [];
                    const result: Result<void, DomainError> = await sut.deletePerson(
                        personGetAllowed.value.id,
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
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([]);

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
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person1.id]);
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

                await sut.getPersonIfAllowed(person1.id, personPermissionsMock);
                const personGetAllowed: Result<Person<true>> = await sut.getPersonIfAllowed(
                    person1.id,
                    personPermissionsMock,
                );
                if (!personGetAllowed.ok) {
                    throw new EntityNotFoundError('Person', person1.id);
                }
                const checkIfDeleteIsAllowedSpy: jest.SpyInstance<
                    Promise<Result<Person<true>, Error>>,
                    [personId: string, permissions: PersonPermissions]
                > = jest.spyOn(sut, 'checkIfDeleteIsAllowed').mockResolvedValue({
                    ok: false,
                    error: new EntityCouldNotBeDeleted('Person', person1.id),
                });

                await sut.checkIfDeleteIsAllowed(personGetAllowed.value.id, personPermissionsMock);

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
                checkIfDeleteIsAllowedSpy.mockRestore();
            });
            it('should not delete the person because it has no keycloakId', async () => {
                const person1: Person<true> = DoFactory.createPerson(true);
                person1.keycloakUserId = '';
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([person1.id]);
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
});
