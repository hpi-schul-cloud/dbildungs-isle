import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
} from '../../../../test/utils/index.js';
import { UserLockRepository } from './user-lock.repository.js';
import { MikroORM } from '@mikro-orm/core';
import { faker } from '@faker-js/faker';
import { UserLock } from '../domain/user-lock.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { mapAggregateToData } from '../../person/persistence/person.repository.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { PersonLockOccasion } from '../../person/domain/person.enums.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';

describe('UserLockRepository', () => {
    let sut: UserLockRepository;
    let orm: MikroORM;
    let module: TestingModule;
    let em: EntityManager;

    const createPersonEntity = (): PersonEntity => {
        const person: PersonEntity = new PersonEntity().assign(mapAggregateToData(DoFactory.createPerson(false)));
        return person;
    };

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true })],
            providers: [UserLockRepository],
        }).compile();

        sut = module.get(UserLockRepository);
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
    });

    describe('findPersonById', () => {
        it('should return an array of UserLocks when found by person', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);

            // Create multiple UserLocks for the same person to test array retrieval
            const userLock1: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );
            const userLock2: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.KOPERS_GESPERRT,
                new Date(),
            );

            await sut.createUserLock(userLock1);
            await sut.createUserLock(userLock2);

            const foundUserLocks: UserLock[] = await sut.findByPersonId(userLock1.person);

            expect(foundUserLocks).toHaveLength(2);
            expect(foundUserLocks[0]!.person).toEqual(userLock1.person);
            expect(foundUserLocks[1]!.person).toEqual(userLock1.person);
        });

        it('should return an empty array when no UserLocks are found by person', async () => {
            const person: string = faker.string.uuid();
            const foundUserLocks: Option<UserLock[]> = await sut.findByPersonId(person);

            // Check that it returns an empty array instead of null
            expect(foundUserLocks).toEqual([]);
        });
    });

    describe('createUserLock', () => {
        it('should create and return a UserLock', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);

            const userLock: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );

            const createdUserLock: UserLock | DomainError = await sut.createUserLock(userLock);
            if (createdUserLock instanceof DomainError) throw new Error();
            expect(createdUserLock).toBeTruthy();
            expect(createdUserLock.person).toEqual(userLock.person);
        });
    });

    describe('update', () => {
        it('should update an existing UserLock', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);

            const userLock: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );

            const createdUserLock: UserLock | DomainError = await sut.createUserLock(userLock);
            if (createdUserLock instanceof DomainError) throw new Error();
            expect(createdUserLock).toBeTruthy();

            createdUserLock.locked_by = faker.string.uuid();
            const updatedUserLock: UserLock | DomainError = await sut.update(createdUserLock);
            if (updatedUserLock instanceof DomainError) throw new Error();
            expect(updatedUserLock).toBeTruthy();
            expect(updatedUserLock.locked_by).toEqual(createdUserLock.locked_by);
        });

        it('should throw error when trying to update a non-existent UserLock', async () => {
            const nonExistentUserLock: UserLock = UserLock.construct(
                faker.string.uuid(),
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );

            await expect(sut.update(nonExistentUserLock)).rejects.toThrowError();
        });
    });

    describe('deleteUserLock', () => {
        it('should delete UserLocks by person', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);

            const userLock1: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );
            const userLock2: UserLock = UserLock.construct(
                newPerson.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.KOPERS_GESPERRT,
                new Date(),
            );

            await sut.createUserLock(userLock1);
            await sut.createUserLock(userLock2);

            // Delete all UserLocks for the person
            await sut.deleteUserLock(newPerson.id, userLock1.locked_occasion);
            await sut.deleteUserLock(newPerson.id, userLock2.locked_occasion);

            const foundUserLocks: Option<UserLock[]> = await sut.findByPersonId(newPerson.id);
            // Expect to find an empty array after deletion
            expect(foundUserLocks).toEqual([]);
        });
    });
    describe('getLocksToUnlock', () => {
        it('should return a list of userLocks for persons without a exceeded lock limitation', async () => {
            const mockPerson1: PersonEntity = createPersonEntity();
            const mockPerson2: PersonEntity = createPersonEntity();
            const mockPerson3: PersonEntity = createPersonEntity();
            await em.persistAndFlush(mockPerson1);
            await em.persistAndFlush(mockPerson2);
            await em.persistAndFlush(mockPerson3);

            //created userLocks with exceeding lock limitation
            const yesterday: Date = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const userLock1: UserLock = UserLock.construct(
                mockPerson1.id,
                faker.string.uuid(),
                yesterday,
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );
            const userLock2: UserLock = UserLock.construct(
                mockPerson2.id,
                faker.string.uuid(),
                new Date(),
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );
            await sut.createUserLock(userLock1);
            await sut.createUserLock(userLock2);
            //create userLock within limitation
            const tomorrow: Date = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const userLock3: UserLock = UserLock.construct(
                mockPerson3.id,
                faker.string.uuid(),
                tomorrow,
                PersonLockOccasion.MANUELL_GESPERRT,
                new Date(),
            );
            await sut.createUserLock(userLock3);

            // get userLocks with exceeding lock limitation
            const foundUserLocks: Option<UserLock[]> = await sut.getLocksToUnlock();
            const userLockIds: PersonID[] = foundUserLocks.map((lock: UserLock) => lock.person);
            expect(userLockIds).toContain(userLock1.person);
            expect(userLockIds).toContain(userLock2.person);
            expect(userLockIds).not.toContain(userLock3.person);
        });
    });
});
