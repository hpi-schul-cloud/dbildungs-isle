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
        it('should return UserLock when found by person', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);
            const userLock: UserLock = UserLock.construct(newPerson.id, faker.string.uuid(), new Date(), new Date());

            const createdUserLock: UserLock | DomainError = await sut.createUserLock(userLock);
            if (createdUserLock instanceof DomainError) throw new Error();
            expect(createdUserLock).toBeTruthy();

            const foundUserLock: Option<UserLock> = await sut.findPersonById(userLock.person);

            expect(foundUserLock).toBeTruthy();
            expect(foundUserLock?.person).toEqual(userLock.person);
        });

        it('should return null when userLock is not found by person', async () => {
            const person: string = faker.string.uuid();
            const foundUserLock: Option<UserLock> = await sut.findPersonById(person);

            expect(foundUserLock).toBeNull();
        });
    });

    describe('createUserLock', () => {
        it('should create and return a UserLock', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);
            const userLock: UserLock = UserLock.construct(newPerson.id, faker.string.uuid(), new Date(), new Date());

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
            const userLock: UserLock = UserLock.construct(newPerson.id, faker.string.uuid(), new Date(), new Date());

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
                new Date(),
            );

            await expect(sut.update(nonExistentUserLock)).rejects.toThrowError();
        });
    });

    describe('deleteUserLock', () => {
        it('should delete UserLock by person', async () => {
            const newPerson: PersonEntity = createPersonEntity();
            await em.persistAndFlush(newPerson);
            const userLock: UserLock = UserLock.construct(newPerson.id, faker.string.uuid(), new Date(), new Date());

            const createdUserLock: UserLock | DomainError = await sut.createUserLock(userLock);
            if (createdUserLock instanceof DomainError) throw new Error();
            expect(createdUserLock).toBeTruthy();

            await sut.deleteUserLock(createdUserLock.person);

            const foundUserLock: Option<UserLock> = await sut.findPersonById(createdUserLock.person);
            expect(foundUserLock).toBeNull();
        });
    });
});
