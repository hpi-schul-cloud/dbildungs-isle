import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DoFactory,
    LoggingTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { Personenkontext, mapAggregateToPartial } from '../domain/personenkontext.js';
import { UsernameGeneratorService } from '../../person/domain/username-generator.service.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { RolleModule } from '../../rolle/rolle.module.js';
import { OrganisationModule } from '../../organisation/organisation.module.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleFactory } from '../../rolle/domain/rolle.factory.js';
import { createMock } from '@golevelup/ts-jest';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { DBiamPersonenkontextRepoInternal } from './internal-dbiam-personenkontext.repo.js';
import { UserLockRepository } from '../../keycloak-administration/repository/user-lock.repository.js';
import { generatePassword } from '../../../shared/util/password-generator.js';

describe('dbiam Personenkontext Repo', () => {
    let module: TestingModule;
    let sut: DBiamPersonenkontextRepoInternal;
    let orm: MikroORM;
    let em: EntityManager;

    let personFactory: PersonFactory;
    let personRepo: PersonRepository;
    let rolleRepo: RolleRepo;

    let personenkontextFactory: PersonenkontextFactory;

    function createPersonenkontext<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        params: Partial<Personenkontext<boolean>> = {},
    ): Personenkontext<WasPersisted> {
        const personenkontext: Personenkontext<WasPersisted> = personenkontextFactory.construct<boolean>(
            withId ? faker.string.uuid() : undefined,
            withId ? faker.date.past() : undefined,
            withId ? faker.date.recent() : undefined,
            undefined,
            faker.string.uuid(),
            faker.string.uuid(),
            faker.string.uuid(),
        );

        Object.assign(personenkontext, params);

        return personenkontext;
    }

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                RolleModule,
                OrganisationModule,
                LoggingTestModule,
            ],
            providers: [
                DBiamPersonenkontextRepoInternal,
                PersonFactory,
                PersonRepository,
                UsernameGeneratorService,
                RolleFactory,
                RolleRepo,
                ServiceProviderRepo,
                PersonenkontextFactory,
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

        sut = module.get(DBiamPersonenkontextRepoInternal);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        personFactory = module.get(PersonFactory);
        personRepo = module.get(PersonRepository);
        rolleRepo = module.get(RolleRepo);
        personenkontextFactory = module.get(PersonenkontextFactory);

        await DatabaseTestModule.setupDatabase(orm);
    }, 10000000);

    async function createPerson(): Promise<Person<true>> {
        const personResult: Person<false> | DomainError = await personFactory.createNew({
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            username: faker.internet.userName(),
            password: generatePassword(),
        });
        if (personResult instanceof DomainError) {
            throw personResult;
        }
        const person: Person<true> | DomainError = await personRepo.create(personResult);
        if (person instanceof DomainError) {
            throw person;
        }

        return person;
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
        expect(em).toBeDefined();
    });

    describe('save', () => {
        it('should save a new personenkontext', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
            if (rolle instanceof DomainError) throw Error();

            const personenkontext: Personenkontext<false> = createPersonenkontext(false, {
                personId: person.id,
                rolleId: rolle.id,
            });

            const savedPersonenkontext: Personenkontext<true> = await sut.save(personenkontext);

            expect(savedPersonenkontext.id).toBeDefined();
        });

        it('should create a new personenkontext with a id set to overrideId', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
            if (rolle instanceof DomainError) throw Error();

            const personenkontext: Personenkontext<false> = createPersonenkontext(false, {
                personId: person.id,
                rolleId: rolle.id,
            });

            personenkontext.id = faker.string.uuid();
            const savedPersonenkontext: Personenkontext<true> = await sut.create(personenkontext);

            expect(savedPersonenkontext.id).toBeDefined();
            expect(savedPersonenkontext.id).toBe(personenkontext.id);
        });

        it('should update an existing rolle', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
            if (rolle instanceof DomainError) throw Error();

            const existingPersonenkontext: Personenkontext<true> = await sut.save(
                createPersonenkontext(false, { personId: person.id, rolleId: rolle.id }),
            );
            const update: Personenkontext<false> = createPersonenkontext(false);
            update.id = existingPersonenkontext.id;

            const savedPersonenkontext: Personenkontext<true> = await sut.save(existingPersonenkontext);

            expect(savedPersonenkontext).toMatchObject(mapAggregateToPartial(existingPersonenkontext));
        });

        it('should throw UniqueConstraintViolationException when triplet already exists', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
            if (rolle instanceof DomainError) throw Error();

            const personenkontext: Personenkontext<false> = createPersonenkontext(false, {
                personId: person.id,
                rolleId: rolle.id,
            });
            await sut.save(personenkontext);

            await expect(sut.save(personenkontext)).rejects.toThrow(UniqueConstraintViolationException);
        });
    });

    describe('delete', () => {
        describe('when personenkontext is found', () => {
            it('should delete personenkontext', async () => {
                const person: Person<true> = await createPerson();
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();

                const personenkontext: Personenkontext<false> = createPersonenkontext(false, {
                    personId: person.id,
                    rolleId: rolle.id,
                });
                const savedPersonenkontext: Personenkontext<true> = await sut.save(personenkontext);
                await expect(sut.delete(savedPersonenkontext)).resolves.not.toThrow();
            });
        });
    });

    describe('deleteById', () => {
        describe('when deleting personenkontext by id', () => {
            it('should return number of deleted rows', async () => {
                const person: Person<true> = await createPerson();
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();

                const personenKontext: Personenkontext<true> = await sut.save(
                    createPersonenkontext(false, { rolleId: rolle.id, personId: person.id }),
                );

                const result: boolean = await sut.deleteById(personenKontext.id);

                expect(result).toBeTruthy();
            });
        });

        describe('when no personenkontext was deleted', () => {
            it('should return 0', async () => {
                const result: boolean = await sut.deleteById(faker.string.uuid());

                expect(result).toBeFalsy();
            });
        });
    });
});
