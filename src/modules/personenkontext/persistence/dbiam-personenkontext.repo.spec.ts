import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DatabaseTestModule,
} from '../../../../test/utils/index.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from './dbiam-personenkontext.repo.js';

function createPersonenkontext<WasPersisted extends boolean>(
    this: void,
    withId: WasPersisted,
    params: Partial<Personenkontext<boolean>> = {},
): Personenkontext<WasPersisted> {
    const personenkontext: Personenkontext<WasPersisted> = Personenkontext.construct<boolean>(
        withId ? faker.string.uuid() : undefined,
        withId ? faker.date.past() : undefined,
        withId ? faker.date.recent() : undefined,
        faker.string.uuid(),
        faker.string.uuid(),
        faker.string.uuid(),
    );

    Object.assign(personenkontext, params);

    return personenkontext;
}

describe('dbiam Personenkontext Repo', () => {
    let module: TestingModule;
    let sut: DBiamPersonenkontextRepo;
    let orm: MikroORM;
    let em: EntityManager;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true })],
            providers: [DBiamPersonenkontextRepo],
        }).compile();

        sut = module.get(DBiamPersonenkontextRepo);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);

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
        expect(em).toBeDefined();
    });

    describe('findByPerson', () => {
        it('should return all personenkontexte for a person', async () => {
            const personA: string = faker.string.uuid();
            const personB: string = faker.string.uuid();

            await Promise.all([
                sut.save(createPersonenkontext(false, { personId: personA })),
                sut.save(createPersonenkontext(false, { personId: personB })),
            ]);

            const personenkontexte: Personenkontext<true>[] = await sut.findByPerson(personA);

            expect(personenkontexte).toHaveLength(1);
        });
    });

    describe('findByRolle', () => {
        it('should return all personenkontexte for a rolle', async () => {
            const rolleUUID: string = faker.string.uuid();
            await sut.save(createPersonenkontext(false, { rolleId: rolleUUID }));
            const personenkontexte: Personenkontext<true>[] = await sut.findByRolle(rolleUUID);
            expect(personenkontexte).toHaveLength(1);
        });
    });

    describe('exists', () => {
        it('should return true, if the triplet exists', async () => {
            const { personId, organisationId, rolleId }: Personenkontext<true> = await sut.save(
                createPersonenkontext(false),
            );

            const exists: boolean = await sut.exists(personId, organisationId, rolleId);

            expect(exists).toBe(true);
        });

        it('should return false, if the triplet does not exists', async () => {
            const exists: boolean = await sut.exists(faker.string.uuid(), faker.string.uuid(), faker.string.uuid());

            expect(exists).toBe(false);
        });
    });

    describe('save', () => {
        it('should save a new personenkontext', async () => {
            const personenkontext: Personenkontext<false> = createPersonenkontext(false);

            const savedPersonenkontext: Personenkontext<true> = await sut.save(personenkontext);

            expect(savedPersonenkontext.id).toBeDefined();
        });

        it('should update an existing rolle', async () => {
            const existingPersonenkontext: Personenkontext<true> = await sut.save(createPersonenkontext(false));
            const update: Personenkontext<false> = createPersonenkontext(false);
            update.id = existingPersonenkontext.id;

            const savedPersonenkontext: Personenkontext<true> = await sut.save(existingPersonenkontext);

            expect(savedPersonenkontext).toEqual(existingPersonenkontext);
        });

        it('should throw UniqueConstraintViolationException when triplet already exists', async () => {
            const personenkontext: Personenkontext<false> = createPersonenkontext(false);
            await sut.save(personenkontext);

            await expect(sut.save(personenkontext)).rejects.toThrow(UniqueConstraintViolationException);
        });
    });
});
