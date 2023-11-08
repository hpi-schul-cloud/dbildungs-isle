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
import { PersonDo } from '../domain/person.do.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { Personenstatus, Rolle } from '../domain/personenkontext.enums.js';
import { PersonPersistenceMapperProfile } from './person-persistence.mapper.profile.js';
import { PersonEntity } from './person.entity.js';
import { PersonenkontextEntity } from './personenkontext.entity.js';
import { PersonenkontextRepo } from './personenkontext.repo.js';

describe('PersonenkontextRepo', () => {
    let module: TestingModule;
    let sut: PersonenkontextRepo;
    let orm: MikroORM;
    let em: EntityManager;
    let mapper: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [PersonPersistenceMapperProfile, PersonenkontextRepo],
        }).compile();
        sut = module.get(PersonenkontextRepo);
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
        describe('When referenced person entity exists', () => {
            it('should create a personenkontext', async () => {
                const newPerson: PersonDo<false> = DoFactory.createPerson(false);
                await em.persistAndFlush(mapper.map(newPerson, PersonDo<false>, PersonEntity));

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<false> = DoFactory.createPersonenkontext(false, {
                    personId: personEntity.id,
                });

                const savedPersonenkontext: Option<PersonenkontextDo<true>> = await sut.save(newPersonenkontext);

                await expect(
                    em.find(PersonenkontextEntity, { id: savedPersonenkontext ? savedPersonenkontext.id : null }),
                ).resolves.toHaveLength(1);
            });

            it('should update a personenkontext and should not create a new personenkontext', async () => {
                const newPerson: PersonDo<false> = DoFactory.createPerson(false);
                await em.persistAndFlush(mapper.map(newPerson, PersonDo<false>, PersonEntity));

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<false> = DoFactory.createPersonenkontext(false, {
                    personId: personEntity.id,
                });

                const savedPersonenkontext: Option<PersonenkontextDo<true>> = await sut.save(newPersonenkontext);
                if (!savedPersonenkontext) {
                    fail('Could not save personenkontext');
                }
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(1);
                await sut.save(savedPersonenkontext);
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(1);
            });

            it('should update a personenkontext with id and should not create a new personenkontext', async () => {
                const newPerson: PersonDo<false> = DoFactory.createPerson(false);
                await em.persistAndFlush(mapper.map(newPerson, PersonDo<false>, PersonEntity));

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true, {
                    personId: personEntity.id,
                });

                const savedPersonenkontext: Option<PersonenkontextDo<true>> = await sut.save(newPersonenkontext);
                if (!savedPersonenkontext) {
                    fail('Could not save personenkontext');
                }
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(1);
                await sut.save(savedPersonenkontext);
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(1);
            });
        });
    });

    describe('findAll', () => {
        describe('When personenkontext for person exists', () => {
            it('should find all personenkontexte for this person', async () => {
                const props: Partial<PersonenkontextDo<false>> = {
                    referrer: 'referrer',
                    personenstatus: Personenstatus.AKTIV,
                    rolle: Rolle.LERNENDER,
                    sichtfreigabe: false,
                };
                const person1Id: string = faker.string.uuid();
                const personenkontextDo1: PersonenkontextDo<false> = DoFactory.createPersonenkontext(false, {
                    ...props,
                    personId: person1Id,
                });
                const personenkontextDo2: PersonenkontextDo<false> = DoFactory.createPersonenkontext(false, props);
                await em.persistAndFlush(mapper.map(personenkontextDo1, PersonenkontextDo, PersonenkontextEntity));
                await em.persistAndFlush(mapper.map(personenkontextDo2, PersonenkontextDo, PersonenkontextEntity));

                const personenkontextDoFromQueryParam: PersonenkontextDo<false> = DoFactory.createPersonenkontext(
                    false,
                    {
                        ...props,
                        personId: person1Id,
                    },
                );

                const result: PersonenkontextDo<true>[] = await sut.findAll(personenkontextDoFromQueryParam);
                expect(result).not.toBeNull();
                expect(result).toHaveLength(1);
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(2);
            });
        });

        describe('When no personenkontext matches', () => {
            it('should return an empty list', async () => {
                const props: Partial<PersonenkontextDo<false>> = {};
                const personenkontextDoFromQueryParam: PersonenkontextDo<false> = DoFactory.createPersonenkontext(
                    false,
                    props,
                );
                const result: PersonenkontextDo<true>[] = await sut.findAll(personenkontextDoFromQueryParam);
                expect(result).not.toBeNull();
                expect(result).toHaveLength(0);
                await expect(em.find(PersonenkontextEntity, {})).resolves.toHaveLength(0);
            });
        });
    });

    describe('findById', () => {
        beforeEach(async () => {
            const personenkontextDos: PersonenkontextDo<false>[] = DoFactory.createMany(
                10,
                false,
                DoFactory.createPersonenkontext,
            );

            await em.persistAndFlush(
                personenkontextDos.map((entity: PersonenkontextDo<false>) =>
                    mapper.map(entity, PersonenkontextDo, PersonenkontextEntity),
                ),
            );
        });

        describe('when finding personenkontext by id', () => {
            it('should return personenkontext', async () => {
                const [personenkontextEntity]: PersonenkontextEntity[] = await em.find<PersonenkontextEntity>(
                    PersonenkontextEntity,
                    {},
                );

                expect(personenkontextEntity?.id).toBeDefined();

                const result: Option<PersonenkontextDo<true>> = await sut.findById(personenkontextEntity?.id as string);

                expect(result).toBeInstanceOf(PersonenkontextDo);
            });
        });

        describe('when NOT finding a personenkontext', () => {
            it('should return null', async () => {
                const result: Option<PersonenkontextDo<true>> = await sut.findById(faker.string.uuid());

                expect(result).toBeNull();
            });
        });
    });
});
