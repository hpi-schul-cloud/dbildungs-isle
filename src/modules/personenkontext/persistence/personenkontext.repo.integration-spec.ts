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
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { Jahrgangsstufe, Personenstatus, Rolle, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { PersonPersistenceMapperProfile } from '../../person/persistence/person-persistence.mapper.profile.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { PersonenkontextEntity } from './personenkontext.entity.js';
import { PersonenkontextRepo } from './personenkontext.repo.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle as RolleAggregate } from '../../rolle/domain/rolle.js';
import { RolleFactory } from '../../rolle/domain/rolle.factory.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { EventModule } from '../../../core/eventbus/event.module.js';
import { mapAggregateToData } from '../../person/persistence/person.repository.js';

describe('PersonenkontextRepo', () => {
    let module: TestingModule;
    let sut: PersonenkontextRepo;
    let orm: MikroORM;
    let em: EntityManager;
    let rolleRepo: RolleRepo;

    const createPersonEntity = (): PersonEntity => {
        const person: PersonEntity = new PersonEntity().assign(mapAggregateToData(DoFactory.createPerson(false)));
        return person;
    };

    function createPersonenkontextDo<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        params: Partial<PersonenkontextDo<boolean>> = {},
    ): PersonenkontextDo<WasPersisted> {
        const personenkontext: PersonenkontextDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            mandant: faker.string.uuid(),
            personId: faker.string.uuid(),
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            organisationId: faker.string.uuid(),
            revision: '1',
            rolle: Rolle.LEHRENDER,
            rolleId: faker.string.uuid(),
            jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
            personenstatus: Personenstatus.AKTIV,
            referrer: 'referrer',
            sichtfreigabe: SichtfreigabeType.JA,
            loeschungZeitpunkt: faker.date.anytime(),
        };

        return Object.assign(new PersonenkontextDo<WasPersisted>(), personenkontext, params);
    }

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                MapperTestModule,
                EventModule,
            ],
            providers: [
                PersonPersistenceMapperProfile,
                PersonenkontextRepo,
                RolleRepo,
                RolleFactory,
                ServiceProviderRepo,
                OrganisationRepository,
            ],
        }).compile();
        sut = module.get(PersonenkontextRepo);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        rolleRepo = module.get(RolleRepo);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

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

    describe('save', () => {
        describe('When referenced person entity exists', () => {
            it('should create a personenkontext', async () => {
                const newPerson: PersonEntity = createPersonEntity();
                const rolle: RolleAggregate<true> = await rolleRepo.save(DoFactory.createRolle(false));

                await em.persistAndFlush(newPerson);

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<false> = createPersonenkontextDo(false, {
                    personId: personEntity.id,
                    rolleId: rolle.id,
                });

                const savedPersonenkontext: Option<PersonenkontextDo<true>> = await sut.save(newPersonenkontext);

                await expect(
                    em.find(PersonenkontextEntity, { id: savedPersonenkontext ? savedPersonenkontext.id : null }),
                ).resolves.toHaveLength(1);
            });

            it('should update a personenkontext and should not create a new personenkontext', async () => {
                const newPerson: PersonEntity = createPersonEntity();
                const rolle: RolleAggregate<true> = await rolleRepo.save(DoFactory.createRolle(false));

                await em.persistAndFlush(newPerson);

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<false> = createPersonenkontextDo(false, {
                    personId: personEntity.id,
                    rolleId: rolle.id,
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
                const newPerson: PersonEntity = createPersonEntity();
                const rolle: RolleAggregate<true> = await rolleRepo.save(DoFactory.createRolle(false));

                await em.persistAndFlush(newPerson);

                const personEntity: PersonEntity = await em.findOneOrFail(PersonEntity, {
                    vorname: newPerson.vorname,
                });
                const newPersonenkontext: PersonenkontextDo<true> = createPersonenkontextDo(true, {
                    personId: personEntity.id,
                    rolleId: rolle.id,
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
});
