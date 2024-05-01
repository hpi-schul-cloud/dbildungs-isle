import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM, RequiredEntityData } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonPersistenceMapperProfile } from './person-persistence.mapper.profile.js';
import { PersonEntity } from './person.entity.js';
import { PersonRepo } from './person.repo.js';
import {
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
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { DomainError, KeycloakClientError } from '../../../shared/error/index.js';

describe('PersonRepository', () => {
    let module: TestingModule;
    let sutLegacy: PersonRepo;
    let sut: PersonRepository;
    let orm: MikroORM;
    let em: EntityManager;
    let mapper: Mapper;
    let kcUserServiceMock: DeepMocked<KeycloakUserService>;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [
                PersonPersistenceMapperProfile,
                PersonRepo,
                PersonRepository,
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
            ],
        }).compile();
        sutLegacy = module.get(PersonRepo);
        sut = module.get(PersonRepository);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        mapper = module.get(getMapperToken());

        kcUserServiceMock = module.get(KeycloakUserService);
        usernameGeneratorService = module.get(UsernameGeneratorService);

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
        expect(sutLegacy).toBeDefined();
    });

    describe('findByKeycloakUserId', () => {
        describe('when found by keycloakUserId', () => {
            it('should return found person', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() });
                await em.persistAndFlush(mapper.map(person, PersonDo, PersonEntity));

                const foundPerson: Option<Person<true>> = await sut.findByKeycloakUserId(person.keycloakUserId);

                expect(foundPerson).toBeInstanceOf(Person);
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
                const person: PersonDo<true> = DoFactory.createPerson(true);
                await em.persistAndFlush(mapper.map(person, PersonDo, PersonEntity));

                const foundPerson: Option<Person<true>> = await sut.findById(person.id);

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
                const person1: PersonDo<true> = DoFactory.createPerson(true);
                const person2: PersonDo<true> = DoFactory.createPerson(true);
                const person3: PersonDo<true> = DoFactory.createPerson(true);
                await em.persistAndFlush(mapper.map(person1, PersonDo, PersonEntity));
                await em.persistAndFlush(mapper.map(person2, PersonDo, PersonEntity));
                await em.persistAndFlush(mapper.map(person3, PersonDo, PersonEntity));

                const scope: PersonScope = new PersonScope()
                    .findBy({
                        vorname: undefined,
                        familienname: undefined,
                        geburtsdatum: undefined,
                    })
                    .sortBy('vorname', ScopeOrder.ASC)
                    .paged(0, 3);

                const [persons, total]: Counted<Person<true>> = await sut.findBy(scope);

                expect(total).toEqual(3);
                expect(persons.at(0)).toBeInstanceOf(Person);
                expect(persons.at(1)).toBeInstanceOf(Person);
                expect(persons.at(2)).toBeInstanceOf(Person);
            });
        });
    });

    describe('create', () => {
        describe('when person has already keycloak user', () => {
            it('should return Domain Error', async () => {
                usernameGeneratorService.generateUsername.mockResolvedValueOnce({ ok: true, value: 'testusername' });
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
                usernameGeneratorService.generateUsername.mockResolvedValueOnce({ ok: true, value: 'testusername' });
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
                usernameGeneratorService.generateUsername.mockResolvedValueOnce({ ok: true, value: 'testusername' });
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
                usernameGeneratorService.generateUsername.mockResolvedValueOnce({ ok: true, value: 'testusername' });
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
    });

    describe('update', () => {
        describe('when person exist', () => {
            describe('when only updating database attributes', () => {
                it('should return updated person', async () => {
                    const existingPerson: PersonDo<true> = DoFactory.createPerson(true);
                    await em.persistAndFlush(mapper.map(existingPerson, PersonDo, PersonEntity));
                    const person: Person<true> = Person.construct(
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
                    await expect(sut.update(person)).resolves.toBeInstanceOf(Person<true>);
                    const result: Person<true> | DomainError = await sut.update(person);
                    expect(result).not.toBeInstanceOf(DomainError);
                    if (result instanceof DomainError) {
                        return;
                    }
                    expect(result.vorname).toEqual(person.vorname);
                    expect(result.familienname).toEqual(person.familienname);
                    expect(kcUserServiceMock.setPassword).not.toHaveBeenCalled();
                });
            });
            describe('when updating keycloak password', () => {
                describe('when keycloak operation succeeds', () => {
                    it('should return updated person', async () => {
                        const existingPerson: PersonDo<true> = DoFactory.createPerson(true);
                        await em.persistAndFlush(mapper.map(existingPerson, PersonDo, PersonEntity));
                        const person: Person<true> = Person.construct(
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

                        await expect(sut.update(person)).resolves.toBeInstanceOf(Person<true>);
                        const result: Person<true> | DomainError = await sut.update(person);
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
                        const existingPerson: PersonDo<true> = DoFactory.createPerson(true);
                        await em.persistAndFlush(mapper.map(existingPerson, PersonDo, PersonEntity));
                        const person: Person<true> = Person.construct(
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
            const personEntity: PersonEntity = mapper.map(
                DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() }),
                PersonDo,
                PersonEntity,
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

            const personEntity: PersonEntity = mapper.map(
                DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() }),
                PersonDo,
                PersonEntity,
            );
            const personAfterUpdate: Person<true> = mapEntityToAggregateInplace(personEntity, person);

            expect(personAfterUpdate).toBeInstanceOf(Person);
            expect(personAfterUpdate.vorname).toEqual(person.vorname);
            expect(personAfterUpdate.familienname).toEqual(person.familienname);
        });
    });
});
