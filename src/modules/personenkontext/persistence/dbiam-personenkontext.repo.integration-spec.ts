import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DoFactory,
    LoggingTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { Personenkontext, mapAggregateToPartial } from '../domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from './dbiam-personenkontext.repo.js';
import { DBiamPersonenkontextRepoInternal } from './internal-dbiam-personenkontext.repo.js';
import { PersonPersistenceMapperProfile } from '../../person/persistence/person-persistence.mapper.profile.js';
import { UsernameGeneratorService } from '../../person/domain/username-generator.service.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { RolleModule } from '../../rolle/rolle.module.js';
import { OrganisationModule } from '../../organisation/organisation.module.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { OrganisationID, PersonenkontextID } from '../../../shared/types/aggregate-ids.types.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleFactory } from '../../rolle/domain/rolle.factory.js';
import { RollenArt, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { createMock } from '@golevelup/ts-jest';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { PersonenkontextScope } from './personenkontext.scope.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import {
    createAndPersistOrganisation,
    createAndPersistRootOrganisation,
} from '../../../../test/utils/organisation-test-helper.js';

describe('dbiam Personenkontext Repo', () => {
    let module: TestingModule;
    let sut: DBiamPersonenkontextRepo;
    let orm: MikroORM;
    let em: EntityManager;

    let personenkontextRepoInternal: DBiamPersonenkontextRepoInternal;
    let personFactory: PersonFactory;
    let personRepo: PersonRepository;
    let organisationRepository: OrganisationRepository;
    let rolleRepo: RolleRepo;
    let rolleFactory: RolleFactory;

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
                DBiamPersonenkontextRepo,
                DBiamPersonenkontextRepoInternal,
                PersonPersistenceMapperProfile,
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
            ],
        }).compile();

        sut = module.get(DBiamPersonenkontextRepo);
        personenkontextRepoInternal = module.get(DBiamPersonenkontextRepoInternal);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        personFactory = module.get(PersonFactory);
        personRepo = module.get(PersonRepository);
        organisationRepository = module.get(OrganisationRepository);
        rolleRepo = module.get(RolleRepo);
        rolleFactory = module.get(RolleFactory);
        personenkontextFactory = module.get(PersonenkontextFactory);

        await DatabaseTestModule.setupDatabase(orm);
    }, 10000000);

    async function createPerson(): Promise<Person<true>> {
        const personResult: Person<false> | DomainError = await personFactory.createNew({
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            username: faker.internet.userName(),
            password: faker.string.alphanumeric(8),
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

    async function createRolle(
        orgaId: OrganisationID,
        rollenart: RollenArt,
        rechte: RollenSystemRecht[],
    ): Promise<Rolle<true>> {
        const rolle: Rolle<false> | DomainError = rolleFactory.createNew(
            faker.word.noun(),
            orgaId,
            rollenart,
            [],
            rechte,
            [],
            [],
            false,
        );

        if (rolle instanceof DomainError) {
            throw rolle;
        }
        const result: Rolle<true> = await rolleRepo.save(rolle);
        return result;
    }

    function createPermissions(person: Person<true>): PersonPermissions {
        return new PersonPermissions(sut, organisationRepository, rolleRepo, person);
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

    describe('findByID', () => {
        it('should return personenkontext by ID', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const personenkontext: Personenkontext<true> = await personenkontextRepoInternal.save(
                createPersonenkontext(false, { personId: person.id, rolleId: rolle.id }),
            );

            const result: Option<Personenkontext<true>> = await sut.findByID(personenkontext.id);

            expect(result).toBeInstanceOf(Personenkontext);
            expect(result?.id).toBe(personenkontext.id);
        });

        it('should return null if not found', async () => {
            const result: Option<Personenkontext<true>> = await sut.findByID(faker.string.uuid());

            expect(result).toBeNull();
        });
    });

    describe('findBy', () => {
        describe('When personenkontext for person exists', () => {
            it('should find all personenkontexte for this person', async () => {
                const person: Person<true> = await createPerson();
                const rolleA: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const rolleB: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const personenkontextA: Personenkontext<true> = await personenkontextRepoInternal.save(
                    createPersonenkontext(false, { personId: person.id, rolleId: rolleA.id }),
                );
                const personenkontextB: Personenkontext<true> = await personenkontextRepoInternal.save(
                    createPersonenkontext(false, { personId: person.id, rolleId: rolleB.id }),
                );

                const scope: PersonenkontextScope = new PersonenkontextScope().findBy({
                    personId: person.id,
                });

                const [result, count]: Counted<Personenkontext<true>> = await sut.findBy(scope);

                expect(result).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining(mapAggregateToPartial(personenkontextA)),
                        expect.objectContaining(mapAggregateToPartial(personenkontextB)),
                    ]),
                );
                expect(count).toBe(2);
            });
        });

        describe('When no personenkontext matches', () => {
            it('should return an empty list', async () => {
                const [result]: Counted<Personenkontext<true>> = await sut.findBy(new PersonenkontextScope());

                expect(result).not.toBeNull();
                expect(result).toHaveLength(0);
            });
        });
    });

    describe('findByPerson', () => {
        it('should return all personenkontexte for a person', async () => {
            const personA: Person<true> = await createPerson();
            const personB: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

            await Promise.all([
                personenkontextRepoInternal.save(
                    createPersonenkontext(false, { personId: personA.id, rolleId: rolle.id }),
                ),
                personenkontextRepoInternal.save(
                    createPersonenkontext(false, { personId: personB.id, rolleId: rolle.id }),
                ),
            ]);

            const personenkontexte: Personenkontext<true>[] = await sut.findByPerson(personA.id);

            expect(personenkontexte).toHaveLength(1);
        });
    });

    describe('findByRolle', () => {
        it('should return all personenkontexte for a rolle', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

            await personenkontextRepoInternal.save(
                createPersonenkontext(false, { rolleId: rolle.id, personId: person.id }),
            );
            const personenkontexte: Personenkontext<true>[] = await sut.findByRolle(rolle.id);

            expect(personenkontexte).toHaveLength(1);
        });
    });

    describe('find', () => {
        describe('when personenkontext exists', () => {
            it('should return a personenkontext by personId, organisationId, rolleId', async () => {
                const person: Person<true> = await createPerson();
                const organisationUUID: string = faker.string.uuid();
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

                await personenkontextRepoInternal.save(
                    createPersonenkontext(false, {
                        rolleId: rolle.id,
                        organisationId: organisationUUID,
                        personId: person.id,
                    }),
                );
                const personenkontext: Option<Personenkontext<true>> = await sut.find(
                    person.id,
                    organisationUUID,
                    rolle.id,
                );

                expect(personenkontext).toBeTruthy();
            });
        });

        describe('when personenkontext does NOT exist', () => {
            it('should return null', async () => {
                const personUUID: string = faker.string.uuid();
                const organisationUUID: string = faker.string.uuid();
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const personenkontext: Option<Personenkontext<true>> = await sut.find(
                    personUUID,
                    organisationUUID,
                    rolle.id,
                );

                expect(personenkontext).toBeNull();
            });
        });
    });

    describe('exists', () => {
        it('should return true, if the triplet exists', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const { personId, organisationId, rolleId }: Personenkontext<true> = await personenkontextRepoInternal.save(
                createPersonenkontext(false, { personId: person.id, rolleId: rolle.id }),
            );

            const exists: boolean = await sut.exists(personId, organisationId, rolleId);

            expect(exists).toBe(true);
        });

        it('should return false, if the triplet does not exists', async () => {
            const exists: boolean = await sut.exists(faker.string.uuid(), faker.string.uuid(), faker.string.uuid());

            expect(exists).toBe(false);
        });
    });

    describe('findByIDAuthorized', () => {
        it('should succeed if the user is authorized', async () => {
            const person: Person<true> = await createPerson();
            const rootOrga: OrganisationID = (await createAndPersistRootOrganisation(em, organisationRepository)).id;
            const rolle: Rolle<true> = await createRolle(rootOrga, RollenArt.SYSADMIN, [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);
            const personenkontext: Personenkontext<true> = await personenkontextRepoInternal.save(
                createPersonenkontext(false, { personId: person.id, organisationId: rootOrga, rolleId: rolle.id }),
            );
            const permissions: PersonPermissions = createPermissions(person);

            const result: Result<Personenkontext<true>, DomainError> = await sut.findByIDAuthorized(
                personenkontext.id,
                permissions,
            );

            expect(result).toEqual({
                ok: true,
                value: expect.objectContaining(mapAggregateToPartial(personenkontext)) as Personenkontext<true>,
            });
        });

        it('should return EntityNotFoundError if not found', async () => {
            const person: Person<true> = await createPerson();
            const rootOrga: OrganisationID = (await createAndPersistRootOrganisation(em, organisationRepository)).id;
            const sysadmin: Rolle<true> = await createRolle(rootOrga, RollenArt.SYSADMIN, [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);
            await personenkontextRepoInternal.save(
                createPersonenkontext(false, { personId: person.id, organisationId: rootOrga, rolleId: sysadmin.id }),
            );
            const permissions: PersonPermissions = createPermissions(person);

            const id: PersonenkontextID = faker.string.uuid();

            const result: Result<Personenkontext<true>, DomainError> = await sut.findByIDAuthorized(id, permissions);

            expect(result).toEqual({
                ok: false,
                error: new EntityNotFoundError('Personenkontext', id),
            });
        });

        it('should return MissingPermissionsError if not authorized', async () => {
            const person: Person<true> = await createPerson();
            const schule: OrganisationID = (await createAndPersistOrganisation(em, undefined, OrganisationsTyp.SCHULE))
                .id;
            const lehrer: Rolle<true> = await createRolle(schule, RollenArt.LEHR, []);
            const personenkontext: Personenkontext<true> = await personenkontextRepoInternal.save(
                createPersonenkontext(false, { personId: person.id, organisationId: schule, rolleId: lehrer.id }),
            );
            const permissions: PersonPermissions = createPermissions(person);

            const result: Result<Personenkontext<true>, DomainError> = await sut.findByIDAuthorized(
                personenkontext.id,
                permissions,
            );

            expect(result).toEqual({
                ok: false,
                error: new MissingPermissionsError('Access denied'),
            });
        });
    });

    describe('findByPersonAuthorized', () => {
        it('should return all personenkontexte for a person when authorized', async () => {
            const adminUser: Person<true> = await createPerson();
            const rootOrga: OrganisationID = (await createAndPersistRootOrganisation(em, organisationRepository)).id;
            const schuleA: OrganisationID = (await createAndPersistOrganisation(em, rootOrga, OrganisationsTyp.SCHULE))
                .id;
            const schuleB: OrganisationID = (await createAndPersistOrganisation(em, rootOrga, OrganisationsTyp.SCHULE))
                .id;
            const lehrerRolle: Rolle<true> = await createRolle(rootOrga, RollenArt.LEHR, []);
            const adminRolle: Rolle<true> = await createRolle(rootOrga, RollenArt.SYSADMIN, [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);

            await personenkontextRepoInternal.save(
                createPersonenkontext(false, {
                    personId: adminUser.id,
                    organisationId: rootOrga,
                    rolleId: adminRolle.id,
                }),
            );

            const personA: Person<true> = await createPerson();
            const personB: Person<true> = await createPerson();

            const [kontext1, kontext2]: [Personenkontext<true>, Personenkontext<true>, Personenkontext<true>] =
                await Promise.all([
                    personenkontextRepoInternal.save(
                        createPersonenkontext(false, {
                            personId: personA.id,
                            rolleId: lehrerRolle.id,
                            organisationId: schuleA,
                        }),
                    ),
                    personenkontextRepoInternal.save(
                        createPersonenkontext(false, {
                            personId: personA.id,
                            rolleId: lehrerRolle.id,
                            organisationId: schuleB,
                        }),
                    ),
                    personenkontextRepoInternal.save(
                        createPersonenkontext(false, {
                            personId: personB.id,
                            rolleId: lehrerRolle.id,
                            organisationId: schuleA,
                        }),
                    ),
                ]);

            const permissions: PersonPermissions = createPermissions(adminUser);

            const result: Result<Personenkontext<true>[], DomainError> = await sut.findByPersonAuthorized(
                personA.id,
                permissions,
            );

            expect(result).toEqual({
                ok: true,
                value: expect.arrayContaining([
                    expect.objectContaining(mapAggregateToPartial(kontext1)),
                    expect.objectContaining(mapAggregateToPartial(kontext2)),
                ]) as Personenkontext<true>[],
            });
        });

        it('should return MissingPermissionsError when user is not authorized', async () => {
            const person: Person<true> = await createPerson();
            const permissions: PersonPermissions = createPermissions(person);

            const result: Result<Personenkontext<true>[], DomainError> = await sut.findByPersonAuthorized(
                person.id,
                permissions,
            );

            expect(result).toEqual({
                ok: false,
                error: new MissingPermissionsError('Not allowed to view the requested personenkontexte'),
            });
        });

        it('should return empty array, when person has no kontexte but user is admin', async () => {
            const adminUser: Person<true> = await createPerson();
            const rootOrga: OrganisationID = (await createAndPersistRootOrganisation(em, organisationRepository)).id;
            const adminRolle: Rolle<true> = await createRolle(rootOrga, RollenArt.SYSADMIN, [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);
            await personenkontextRepoInternal.save(
                createPersonenkontext(false, {
                    personId: adminUser.id,
                    organisationId: rootOrga,
                    rolleId: adminRolle.id,
                }),
            );
            const person: Person<true> = await createPerson();
            const permissions: PersonPermissions = createPermissions(adminUser);

            const result: Result<Personenkontext<true>[], DomainError> = await sut.findByPersonAuthorized(
                person.id,
                permissions,
            );

            expect(result).toEqual({
                ok: true,
                value: [],
            });
        });
    });

    describe('isOrganisationAlreadyAssigned', () => {
        it('should return true if there is any personenkontext for an organisation', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const organisation: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                typ: OrganisationsTyp.KLASSE,
            });
            await personenkontextRepoInternal.save(
                createPersonenkontext(false, {
                    rolleId: rolle.id,
                    personId: person.id,
                    organisationId: organisation.id,
                }),
            );

            const result: boolean = await sut.isOrganisationAlreadyAssigned(organisation.id);
            expect(result).toBeTruthy();
        });
    });

    describe('isRolleAlreadyAssigned', () => {
        it('should return true if there is any personenkontext for a rolle', async () => {
            const person: Person<true> = await createPerson();
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

            await personenkontextRepoInternal.save(
                createPersonenkontext(false, { rolleId: rolle.id, personId: person.id }),
            );
            const result: boolean = await sut.isRolleAlreadyAssigned(rolle.id);

            expect(result).toBeTruthy();
        });

        it('should return false if there is no  personenkontext for an organisation', async () => {
            const result: boolean = await sut.isOrganisationAlreadyAssigned(faker.string.uuid());
            expect(result).toBeFalsy();
        });

        it('should return false if there is no  personenkontext for a rolle', async () => {
            const result: boolean = await sut.isRolleAlreadyAssigned(faker.string.uuid());

            expect(result).toBeFalsy();
        });
    });

    describe('getPersonenKontexteWithExpiredBefristung', () => {
        it('should return a grouped list of Personenkontext records with expired befristung', async () => {
            // Create a date 1 day in the past for testing
            const pastDate: Date = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const futureDate: Date = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const person1: Person<true> = await createPerson();
            const person2: Person<true> = await createPerson();
            const person3: Person<true> = await createPerson();

            const rolle1: Rolle<false> = DoFactory.createRolle(false, {
                name: 'rolle1',
                rollenart: RollenArt.EXTERN,
            });

            const rolle1Result: Rolle<true> = await rolleRepo.save(rolle1);

            //Kontexte with exceeding Befristung
            const personenKontext1: Personenkontext<false> = DoFactory.createPersonenkontext(false, {
                personId: person1.id,
                rolleId: rolle1Result.id,
                befristung: pastDate,
            });

            const personenKontext2: Personenkontext<false> = DoFactory.createPersonenkontext(false, {
                personId: person2.id,
                rolleId: rolle1Result.id,
                befristung: pastDate,
            });

            //Kontexte without exceeding Befristung
            const personenKontext3: Personenkontext<false> = DoFactory.createPersonenkontext(false, {
                personId: person1.id,
                rolleId: rolle1Result.id,
                befristung: futureDate,
            });

            const personenKontext4: Personenkontext<false> = DoFactory.createPersonenkontext(false, {
                personId: person2.id,
                rolleId: rolle1Result.id,
                befristung: futureDate,
            });

            const personenKontext5: Personenkontext<false> = DoFactory.createPersonenkontext(false, {
                personId: person3.id,
                rolleId: rolle1Result.id,
                befristung: futureDate,
            });

            await personenkontextRepoInternal.save(personenKontext1);
            await personenkontextRepoInternal.save(personenKontext2);
            await personenkontextRepoInternal.save(personenKontext3);
            await personenkontextRepoInternal.save(personenKontext4);
            await personenkontextRepoInternal.save(personenKontext5);

            const result: Map<string, Personenkontext<true>[]> = await sut.getPersonenKontexteWithExpiredBefristung();

            expect(result.has(person1.id)).toBe(true);
            expect(result.get(person1.id)).toHaveLength(2);

            expect(result.has(person2.id)).toBe(true);
            expect(result.get(person2.id)).toHaveLength(2);
        });
    });
});
