import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DatabaseTestModule,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { ScopeOperator } from '../../../shared/persistence/scope.enums.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonPersistenceMapperProfile } from './person-persistence.mapper.profile.js';
import { PersonEntity } from './person.entity.js';
import { PersonRepo } from './person.repo.js';
import { PersonScope } from './person.scope.js';

describe('PersonRepo', () => {
    let module: TestingModule;
    let sut: PersonRepo;
    let orm: MikroORM;
    let em: EntityManager;
    let mapper: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [PersonPersistenceMapperProfile, PersonRepo],
        }).compile();
        sut = module.get(PersonRepo);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        mapper = module.get(getMapperToken());
        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('save', () => {
        describe('when creating person', () => {
            it('should create person', async () => {
                const person: PersonDo<false> = DoFactory.createPerson(false, { referrer: faker.string.uuid() });
                await sut.save(person);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(1);
            });
        });

        describe('when updating person', () => {
            it('should update person', async () => {
                const newPerson: PersonDo<false> = DoFactory.createPerson(false);
                const savedPerson: PersonDo<true> = await sut.save(newPerson);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(1);
                savedPerson.referrer = faker.string.uuid();
                await sut.save(savedPerson);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(1);
                await expect(em.find(PersonEntity, { referrer: savedPerson.referrer })).resolves.toHaveLength(1);
            });

            it('should create person', async () => {
                const newPerson: PersonDo<false> = DoFactory.createPerson(false, { id: faker.string.uuid() });
                const savedPerson: PersonDo<true> = await sut.save(newPerson);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(1);
                savedPerson.referrer = faker.string.uuid();
                await sut.save(savedPerson);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(1);
                await expect(em.find(PersonEntity, { referrer: savedPerson.referrer })).resolves.toHaveLength(1);
            });
        });
    });

    describe('findById', () => {
        describe('when found by id', () => {
            it('should return found person', async () => {
                const personDo: PersonDo<false> = DoFactory.createPerson(false, { referrer: faker.string.uuid() });
                await em.persistAndFlush(mapper.map(personDo, PersonDo, PersonEntity));
                const [person]: PersonEntity[] = await em.find(PersonEntity, {});
                expect(person).toBeInstanceOf(PersonEntity);
                const foundPerson: Option<PersonDo<true>> = await sut.findById((person as PersonEntity).id);
                expect(foundPerson).toBeInstanceOf(PersonDo);
            });
        });

        describe('when not found by id', () => {
            it('should return null', async () => {
                const foundPerson: Option<PersonDo<true>> = await sut.findById(faker.string.uuid());
                expect(foundPerson).toBeNull();
            });
        });
    });

    describe('findByReferrer', () => {
        describe('when found by referrer', () => {
            it('should return found person', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true, { referrer: faker.string.uuid() });
                await em.persistAndFlush(mapper.map(person, PersonDo, PersonEntity));
                const foundPerson: Option<PersonDo<true>> = await sut.findByReferrer(person.referrer as string);
                expect(foundPerson).toBeInstanceOf(PersonDo);
            });
        });

        describe('when not found by referrer', () => {
            it('should return null', async () => {
                const foundPerson: Option<PersonDo<true>> = await sut.findByReferrer(faker.string.uuid());
                expect(foundPerson).toBeNull();
            });
        });
    });

    describe('findByKeycloakUserId', () => {
        describe('when found by keycloakUserId', () => {
            it('should return found person', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true, { keycloakUserId: faker.string.uuid() });
                await em.persistAndFlush(mapper.map(person, PersonDo, PersonEntity));
                const foundPerson: Option<PersonDo<true>> = await sut.findByKeycloakUserId(person.keycloakUserId);
                expect(foundPerson).toBeInstanceOf(PersonDo);
            });
        });

        describe('when not found by keycloakUserId', () => {
            it('should return null', async () => {
                const foundPerson: Option<PersonDo<true>> = await sut.findByKeycloakUserId(faker.string.uuid());
                expect(foundPerson).toBeNull();
            });
        });
    });

    describe('deleteById', () => {
        describe('when person exists', () => {
            it('should delete person from database', async () => {
                const personDo: PersonDo<false> = DoFactory.createPerson(false, { referrer: faker.string.uuid() });
                const personEntity: PersonEntity = mapper.map(personDo, PersonDo, PersonEntity);
                await em.persistAndFlush(personEntity);
                const [person]: PersonEntity[] = await em.find(PersonEntity, {});
                expect(person).toBeInstanceOf(PersonEntity);
                await expect(sut.deleteById(person?.id as string)).resolves.not.toThrow();
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(0);
            });
        });

        describe('when person not exists', () => {
            it('should return null', async () => {
                const deletedPerson: Option<PersonDo<false>> = await sut.deleteById(faker.string.uuid());
                expect(deletedPerson).toBeNull();
            });
        });
    });

    describe('findAll', () => {
        describe('when persons match the query', () => {
            it('should return all matching persons', async () => {
                const props: Partial<PersonDo<false>> = {
                    referrer: 'referrer_value',
                    vorname: 'first name',
                    familienname: 'last name',
                    auskunftssperre: false,
                };
                const personDo1: PersonDo<false> = DoFactory.createPerson(false, props);
                const personDo2: PersonDo<false> = DoFactory.createPerson(false, props);

                await em.persistAndFlush(mapper.map(personDo1, PersonDo, PersonEntity));
                await em.persistAndFlush(mapper.map(personDo2, PersonDo, PersonEntity));

                const [result]: Counted<PersonDo<true>> = await sut.findBy(
                    new PersonScope().findBy(
                        {
                            vorname: props.vorname,
                            familienname: props.familienname,
                        },
                        ScopeOperator.AND,
                    ),
                );

                expect(result).not.toBeNull();
                expect(result).toHaveLength(2);
                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(2);
            });
        });

        describe('when no person matches the query', () => {
            it('should return an empty list', async () => {
                const [result]: Counted<PersonDo<true>> = await sut.findBy(new PersonScope());

                expect(result).not.toBeNull();
                expect(result).toHaveLength(0);

                await expect(em.find(PersonEntity, {})).resolves.toHaveLength(0);
            });
        });
    });
});
