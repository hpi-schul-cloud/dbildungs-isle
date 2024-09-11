import { Test, TestingModule } from '@nestjs/testing';
import { DbSeedService } from './db-seed.service.js';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DoFactory,
    LoggingTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import fs from 'fs';
import { DataProviderFile } from '../file/data-provider-file.js';
import { PersonFactory } from '../../../modules/person/domain/person.factory.js';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { EntityNotFoundError } from '../../../shared/error/index.js';
import { faker } from '@faker-js/faker';
import { RolleRepo } from '../../../modules/rolle/repo/rolle.repo.js';
import { Rolle } from '../../../modules/rolle/domain/rolle.js';
import { RolleFactory } from '../../../modules/rolle/domain/rolle.factory.js';
import { ServiceProviderRepo } from '../../../modules/service-provider/repo/service-provider.repo.js';
import { DBiamPersonenkontextRepo } from '../../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { ServiceProviderFactory } from '../../../modules/service-provider/domain/service-provider.factory.js';
import { KeycloakUserService, User } from '../../../modules/keycloak-administration/index.js';
import { Person } from '../../../modules/person/domain/person.js';
import { DBiamPersonenkontextService } from '../../../modules/personenkontext/domain/dbiam-personenkontext.service.js';
import { DbSeedReferenceRepo } from '../repo/db-seed-reference.repo.js';
import { ServiceProvider } from '../../../modules/service-provider/domain/service-provider.js';
import { GleicheRolleAnKlasseWieSchuleError } from '../../../modules/personenkontext/specification/error/gleiche-rolle-an-klasse-wie-schule.error.js';
import { PersonenkontextFactory } from '../../../modules/personenkontext/domain/personenkontext.factory.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import { KeycloakGroupRoleService } from '../../../modules/keycloak-administration/domain/keycloak-group-role.service.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { NameForOrganisationWithTrailingSpaceError } from '../../../modules/organisation/specification/error/name-with-trailing-space.error.js';
import { NameForRolleWithTrailingSpaceError } from '../../../modules/rolle/domain/name-with-trailing-space.error.js';
import { RollenMerkmal } from '../../../modules/rolle/domain/rolle.enums.js';
import { Personenkontext } from '../../../modules/personenkontext/domain/personenkontext.js';

describe('DbSeedService', () => {
    let module: TestingModule;
    let dbSeedService: DbSeedService;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let personRepoMock: DeepMocked<PersonRepository>;
    let serviceProviderRepoMock: DeepMocked<ServiceProviderRepo>;
    let personenkontextServiceMock: DeepMocked<DBiamPersonenkontextService>;
    let dbSeedReferenceRepoMock: DeepMocked<DbSeedReferenceRepo>;
    let kcUserService: DeepMocked<KeycloakUserService>;
    let dBiamPersonenkontextRepo: DeepMocked<DBiamPersonenkontextRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                LoggingTestModule,
                ConfigTestModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: false }),
            ],
            providers: [
                DbSeedService,
                RolleFactory,
                ServiceProviderFactory,
                PersonenkontextFactory,
                {
                    provide: DBiamPersonenkontextService,
                    useValue: createMock<DBiamPersonenkontextService>(),
                },
                {
                    provide: DbSeedReferenceRepo,
                    useValue: createMock<DbSeedReferenceRepo>(),
                },
                {
                    provide: PersonFactory,
                    useValue: createMock<PersonFactory>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: ServiceProviderRepo,
                    useValue: createMock<ServiceProviderRepo>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: KeycloakGroupRoleService,
                    useValue: createMock<KeycloakGroupRoleService>(),
                },
            ],
        }).compile();
        dbSeedService = module.get(DbSeedService);
        organisationRepositoryMock = module.get(OrganisationRepository);
        rolleRepoMock = module.get(RolleRepo);
        personRepoMock = module.get(PersonRepository);
        serviceProviderRepoMock = module.get(ServiceProviderRepo);
        personenkontextServiceMock = module.get(DBiamPersonenkontextService);
        dbSeedReferenceRepoMock = module.get(DbSeedReferenceRepo);
        kcUserService = module.get(KeycloakUserService);
        dBiamPersonenkontextRepo = module.get(DBiamPersonenkontextRepo);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(dbSeedService).toBeDefined();
    });

    describe('readDataProvider', () => {
        describe('readDataProvider with one entity', () => {
            it('should have length 1', () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/all/01/00_data-provider.json`,
                    'utf-8',
                );
                const entities: DataProviderFile[] = dbSeedService.readDataProvider(fileContentAsStr);
                const entity: DataProviderFile | undefined = entities[0];
                const dataProvider: Partial<DataProviderFile> = {
                    id: '431d8433-759c-4dbe-aaab-00b9a781f467',
                };
                expect(entities).toHaveLength(1);
                expect(entity).toEqual(dataProvider);
            });
        });
    });

    describe('seedOrganisation', () => {
        describe('without administriertVon and zugehoerigZu', () => {
            it('should insert one entity in database', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/all/01/01_organisation.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);

                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });

        describe('with only nulls', () => {
            it('should insert one entity in database', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/00_organisation_with_only_nulls.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);

                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });

        describe('with existing administriertVon', () => {
            it('should not throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/01_organisation.json`,
                    'utf-8',
                );
                const parent: Organisation<true> = createMock<Organisation<true>>();
                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(parent);
                //USE MockResolved instead of MockRecolvedOnce because it's called for administriert and zugehoerigZu
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(parent);

                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });

        describe('with existing zugehoerigZu', () => {
            it('should not throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/02_organisation.json`,
                    'utf-8',
                );
                const parent: Organisation<true> = createMock<Organisation<true>>();
                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(parent);
                //USE MockResolved instead of MockRecolvedOnce because it's called for administriert and zugehoerigZu
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(parent); // mock get-SSK

                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });

        describe('with non existing administriertVon', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/04_missing_administriert-von.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);

                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });

        describe('with non existing zugehoerigZu', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/05_missing_zugehoerig-zu.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);

                organisationRepositoryMock.save.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
        describe('kuerzel = root', () => {
            it('should create root orga', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/06_kuerzel-is-root.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);

                organisationRepositoryMock.saveSeedData.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });
        describe('Should throw error', () => {
            it('should throw NameForOrganisationWithTrailingSpaceError if OrganisationFactory.createNew returns DomainError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/organisation/07_organisation_with_invalid_name.json`,
                    'utf-8',
                );
                const persistedOrganisation: Organisation<true> = DoFactory.createOrganisationAggregate(true);
                const parent: Organisation<true> = createMock<Organisation<true>>();
                organisationRepositoryMock.save.mockResolvedValueOnce(parent);
                //USE MockResolved instead of MockRecolvedOnce because it's called for administriert and zugehoerigZu
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(parent);

                organisationRepositoryMock.save.mockResolvedValueOnce(persistedOrganisation);
                await expect(dbSeedService.seedOrganisation(fileContentAsStr)).rejects.toThrow(
                    NameForOrganisationWithTrailingSpaceError,
                );
            });
        });
    });

    describe('seedRolle', () => {
        describe('with existing organisation for administeredBySchulstrukturknoten and ID', () => {
            it('should insert one entity in database', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/04_rolle-with-existing-ssk.json`,
                    'utf-8',
                );
                const persistedRolle: Rolle<true> = DoFactory.createRolle(true);
                const serviceProviderMocked: ServiceProvider<true> = createMock<ServiceProvider<true>>();

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced serviceProvider
                serviceProviderRepoMock.findById.mockResolvedValueOnce(serviceProviderMocked);
                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock get-SSK

                rolleRepoMock.save.mockResolvedValueOnce(persistedRolle);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).resolves.not.toThrow(EntityNotFoundError);
            });
        });

        describe('with existing organisation for administeredBySchulstrukturknoten but without ID', () => {
            it('should insert one entity in database', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/07_rolle_without_id.json`,
                    'utf-8',
                );
                const persistedRolle: Rolle<true> = DoFactory.createRolle(true);
                const serviceProviderMocked: ServiceProvider<true> = createMock<ServiceProvider<true>>();

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced serviceProvider
                serviceProviderRepoMock.findById.mockResolvedValueOnce(serviceProviderMocked);
                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock get-SSK

                rolleRepoMock.save.mockResolvedValueOnce(persistedRolle);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).resolves.not.toThrow(EntityNotFoundError);
            });
        });

        describe('with non-existing organisation for administeredBySchulstrukturknoten', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/05_rolle-with-non-existing-ssk.json`,
                    'utf-8',
                );
                const persistedRolle: Rolle<true> = DoFactory.createRolle(true);
                const serviceProviderMocked: ServiceProvider<true> = createMock<ServiceProvider<true>>();

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced serviceProvider
                serviceProviderRepoMock.findById.mockResolvedValueOnce(serviceProviderMocked);

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockRejectedValueOnce(new EntityNotFoundError());

                rolleRepoMock.save.mockResolvedValueOnce(persistedRolle);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });

        describe('with non-existing serviceProvider for in serviceProviderIds', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/06_rolle-with-non-existing-sp.json`,
                    'utf-8',
                );
                const persistedRolle: Rolle<true> = DoFactory.createRolle(true);

                rolleRepoMock.save.mockResolvedValueOnce(persistedRolle);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });

        describe('should throw error', () => {
            it('should throw NameValidationError if OrganisationFactory.createNew returns DomainError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/08_rolle-with-invalid-name.json`,
                    'utf-8',
                );
                const persistedRolle: Rolle<true> = DoFactory.createRolle(true);
                const serviceProviderMocked: ServiceProvider<true> = createMock<ServiceProvider<true>>();

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced serviceProvider
                serviceProviderRepoMock.findById.mockResolvedValueOnce(serviceProviderMocked);
                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID of referenced parent
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock get-SSK

                rolleRepoMock.save.mockResolvedValueOnce(persistedRolle);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).rejects.toThrow(
                    NameForRolleWithTrailingSpaceError,
                );
            });
        });
    });

    describe('seedServiceProvider', () => {
        describe('seedServiceProvider with two entities', () => {
            it('should not throw an error', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/serviceProvider/03_service-provider.json`,
                    'utf-8',
                );
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID providedOnSchulstrukturknoten
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock get-SSK

                await expect(dbSeedService.seedServiceProvider(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });
    });

    describe('seedPerson', () => {
        describe('person already exists in keycloak', () => {
            it('should delete the person and then create it again', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/existingPerson/02_person.json`,
                    'utf-8',
                );

                const person: Person<true> = createMock<Person<true>>();
                const existingUser: User<true> = User.construct<true>(
                    faker.string.uuid(),
                    'testusername',
                    'test@example.com',
                    faker.date.recent(),
                    {
                        ID_ITSLEARNING: [faker.string.uuid()],
                    },
                    true,
                    {},
                );

                kcUserService.findOne.mockResolvedValueOnce({ ok: true, value: existingUser });
                kcUserService.delete.mockResolvedValueOnce({ ok: true, value: undefined });
                personRepoMock.create.mockResolvedValue(person);

                await dbSeedService.seedPerson(fileContentAsStr);

                await expect(dbSeedService.seedPerson(fileContentAsStr)).resolves.not.toThrow(EntityNotFoundError);
                expect(kcUserService.delete).toHaveBeenCalled();
            });
        });
    });

    describe('seedPersonkontext', () => {
        describe('with violated Personenkontext Klasse specification', () => {
            it('should throw GleicheRolleAnKlasseWieSchuleError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                personRepoMock.findById.mockResolvedValue(createMock<Person<true>>()); // mock getReferencedPerson

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock getReferencedOrganisation

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                rolleRepoMock.findById.mockResolvedValue(createMock<Rolle<true>>({ merkmale: [] })); // mock getReferencedRolle

                personenkontextServiceMock.checkSpecifications.mockResolvedValueOnce(
                    new GleicheRolleAnKlasseWieSchuleError(),
                );
                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(
                    GleicheRolleAnKlasseWieSchuleError,
                );
            });
        });

        describe('with Rolle with Befristung', () => {
            it('should insert one entity with Befristung', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                personRepoMock.findById.mockResolvedValue(createMock<Person<true>>()); // mock getReferencedPerson

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock getReferencedOrganisation

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                rolleRepoMock.findById.mockResolvedValue(
                    createMock<Rolle<true>>({ merkmale: [RollenMerkmal.BEFRISTUNG_PFLICHT] }),
                ); // mock getReferencedRolle

                personenkontextServiceMock.checkSpecifications.mockResolvedValueOnce(null);
                dBiamPersonenkontextRepo.save.mockResolvedValueOnce({} as Personenkontext<true>);

                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).resolves.not.toThrow(
                    EntityNotFoundError,
                );
            });
        });
    });

    describe('getReferencedPerson', () => {
        describe('when person cannot be found via PersonRepository', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID was found via seeding-ref-table
                personRepoMock.findById.mockResolvedValue(undefined);
                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
    });

    describe('getReferencedOrganisation', () => {
        describe('when organisation cannot be found via OrganisationRepository', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for person, found via seeding-ref-table
                personRepoMock.findById.mockResolvedValue(createMock<Person<true>>());
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for orga, found via seeding-ref-table
                organisationRepositoryMock.findById.mockResolvedValue(undefined);

                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
    });

    describe('getReferencedRolle', () => {
        describe('when rolle cannot be found seeding-ref table', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );

                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID for person, found via seeding-ref-table
                personRepoMock.findById.mockResolvedValue(createMock<Person<true>>());
                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(faker.string.uuid()); //mock UUID for orga, found via seeding-ref-table
                organisationRepositoryMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());
                dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(undefined); //mock UUID for rolle, found via seeding-ref-table

                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
        describe('seedPersonenkontext', () => {
            describe('when person UUID cannot be found', () => {
                it('should throw EntityNotFoundError', async () => {
                    const fileContentAsStr: string = fs.readFileSync(
                        `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                        'utf-8',
                    );

                    // Mock dbSeedReferenceRepo to return undefined for the person UUID
                    dbSeedReferenceRepoMock.findUUID.mockResolvedValueOnce(undefined);

                    await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(
                        EntityNotFoundError,
                    );
                });
            });

            describe('with violated Personenkontext Klasse specification', () => {
                it('should throw GleicheRolleAnKlasseWieSchuleError', async () => {
                    const fileContentAsStr: string = fs.readFileSync(
                        `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                        'utf-8',
                    );
                    dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                    personRepoMock.findById.mockResolvedValue(createMock<Person<true>>()); // mock getReferencedPerson

                    dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                    organisationRepositoryMock.findById.mockResolvedValue(createMock<Organisation<true>>()); // mock getReferencedOrganisation

                    dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID in seeding-ref-table
                    rolleRepoMock.findById.mockResolvedValue(createMock<Rolle<true>>({ merkmale: [] })); // mock getReferencedRolle

                    personenkontextServiceMock.checkSpecifications.mockResolvedValueOnce(
                        new GleicheRolleAnKlasseWieSchuleError(),
                    );
                    await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(
                        GleicheRolleAnKlasseWieSchuleError,
                    );
                });
            });
        });

        describe('when rolle cannot be found via RolleRepository', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/personenkontext/05_personenkontext.json`,
                    'utf-8',
                );

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for person, found via seeding-ref-table
                personRepoMock.findById.mockResolvedValue(createMock<Person<true>>());
                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for orga, found via seeding-ref-table
                organisationRepositoryMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for rolle, found via seeding-ref-table
                rolleRepoMock.findById.mockResolvedValue(undefined);

                await expect(dbSeedService.seedPersonenkontext(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
    });

    describe('getReferencedServiceProvider', () => {
        describe('when serviceProvider cannot be found via ServiceProviderRepository', () => {
            it('should throw EntityNotFoundError', async () => {
                const fileContentAsStr: string = fs.readFileSync(
                    `./seeding/seeding-integration-test/rolle/06_rolle-with-non-existing-sp.json`,
                    'utf-8',
                );

                dbSeedReferenceRepoMock.findUUID.mockResolvedValue(faker.string.uuid()); //mock UUID for SP was found via seeding-ref-table
                serviceProviderRepoMock.findById.mockResolvedValue(undefined);
                await expect(dbSeedService.seedRolle(fileContentAsStr)).rejects.toThrow(EntityNotFoundError);
            });
        });
    });

    describe('getEntityFileNames', () => {
        describe('getEntityFileNames in directory sql/seeding-integration-test', () => {
            it('should return all files in directory', () => {
                const entityFileNames: string[] = dbSeedService.getEntityFileNames(
                    'seeding-integration-test/all',
                    '01',
                );
                expect(entityFileNames).toHaveLength(6);
            });
        });
    });
});
