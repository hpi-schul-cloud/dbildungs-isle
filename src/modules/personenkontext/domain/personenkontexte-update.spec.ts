import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { DBiamPersonenkontextRepoInternal } from '../persistence/internal-dbiam-personenkontext.repo.js';
import { PersonenkontexteUpdate } from './personenkontexte-update.js';
import { DbiamPersonenkontextFactory } from './dbiam-personenkontext.factory.js';
import { PersonID } from '../../../shared/types/index.js';
import { DbiamPersonenkontextBodyParams } from '../api/param/dbiam-personenkontext.body.params.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { UpdatePersonIdMismatchError } from './error/update-person-id-mismatch.error.js';
import { Personenkontext } from './personenkontext.js';
import { UpdateCountError } from './error/update-count.error.js';
import { UpdateOutdatedError } from './error/update-outdated.error.js';
import { PersonenkontexteUpdateError } from './error/personenkontexte-update.error.js';
import { PersonenkontextFactory } from './personenkontext.factory.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { EventService } from '../../../core/eventbus/index.js';
import { UpdatePersonNotFoundError } from './error/update-person-not-found.error.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import { DoFactory, PersonPermissionsMock } from '../../../../test/utils/index.js';
import { Person } from '../../person/domain/person.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt, RollenMerkmal } from '../../rolle/domain/rolle.enums.js';
import { UpdateInvalidRollenartForLernError } from './error/update-invalid-rollenart-for-lern.error.js';
import { PersonenkontextBefristungRequiredError } from './error/personenkontext-befristung-required.error.js';
import { CheckBefristungSpecification } from '../specification/befristung-required-bei-rolle-befristungspflicht.js';

function createPKBodyParams(personId: PersonID): DbiamPersonenkontextBodyParams[] {
    const firstCreatePKBodyParams: DbiamPersonenkontextBodyParams = createMock<DbiamPersonenkontextBodyParams>({
        personId: personId,
        organisationId: faker.string.uuid(),
        rolleId: faker.string.uuid(),
    });

    const secondCreatePKBodyParams: DbiamPersonenkontextBodyParams = createMock<DbiamPersonenkontextBodyParams>({
        personId: personId,
        organisationId: faker.string.uuid(),
        rolleId: faker.string.uuid(),
    });

    return [firstCreatePKBodyParams, secondCreatePKBodyParams];
}

describe('PersonenkontexteUpdate', () => {
    let module: TestingModule;
    let personRepoMock: DeepMocked<PersonRepository>;
    let dBiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let dBiamPersonenkontextRepoInternalMock: DeepMocked<DBiamPersonenkontextRepoInternal>;
    let dbiamPersonenkontextFactory: DbiamPersonenkontextFactory;
    let sut: PersonenkontexteUpdate;
    let personId: string;
    let lastModified: Date;
    let bodyParam1: DbiamPersonenkontextBodyParams;
    let bodyParam2: DbiamPersonenkontextBodyParams;
    let pk1: Personenkontext<true>;
    let pk2: Personenkontext<true>;
    let personPermissionsMock: PersonPermissionsMock;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepoInternal,
                    useValue: createMock<DBiamPersonenkontextRepoInternal>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                EventService,
                DbiamPersonenkontextFactory,
                PersonenkontextFactory,
            ],
        }).compile();
        dBiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        dBiamPersonenkontextRepoInternalMock = module.get(DBiamPersonenkontextRepoInternal);
        personRepoMock = module.get(PersonRepository);
        dbiamPersonenkontextFactory = module.get(DbiamPersonenkontextFactory);
        personId = faker.string.uuid();
        lastModified = faker.date.recent();
        bodyParam1 = createMock<DbiamPersonenkontextBodyParams>({
            personId: personId,
            organisationId: faker.string.uuid(),
            rolleId: faker.string.uuid(),
        });
        bodyParam2 = createMock<DbiamPersonenkontextBodyParams>({
            personId: personId,
            organisationId: faker.string.uuid(),
            rolleId: faker.string.uuid(),
        });
        pk1 = createMock<Personenkontext<true>>({
            updatedAt: lastModified,
            personId: bodyParam1.personId,
            organisationId: bodyParam1.organisationId,
            rolleId: bodyParam1.rolleId,
            befristung: undefined,
        });
        pk2 = createMock<Personenkontext<true>>({
            updatedAt: faker.date.past(),
            personId: bodyParam2.personId,
            organisationId: bodyParam2.organisationId,
            rolleId: bodyParam2.rolleId,
        });
        personPermissionsMock = new PersonPermissionsMock();
        rolleRepoMock = module.get(RolleRepo);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(dbiamPersonenkontextFactory).toBeDefined();
    });

    describe('update', () => {
        describe('when sent personenkontexte contain new personenkontext', () => {
            beforeAll(() => {
                const count: number = 1;

                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    createPKBodyParams(personId),
                    personPermissionsMock,
                );
            });

            it('should return PersonenkontextSpecificationError', async () => {
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(null);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(null); //mock pk2 is not found => therefore handled as new
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]); //mock pk1 is found as existing in DB

                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); // mock while checking the existing PKs
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock the return values in the end of update method
                const mapRollen: Map<string, Rolle<true>> = createMock<Map<string, Rolle<true>>>({
                    get: () =>
                        DoFactory.createRolle(true, {
                            rollenart: RollenArt.LEHR,
                            merkmale: [RollenMerkmal.KOPERS_PFLICHT],
                            id: pk1.rolleId,
                            serviceProviderData: [DoFactory.createServiceProvider(true)],
                        }),
                });
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateResult).toBeInstanceOf(Array);
            });
        });

        describe('when personenkontext could not be saved', () => {
            beforeAll(() => {
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    0,
                    [pk1],
                    personPermissionsMock,
                );
            });

            it('should log error', async () => {
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(null);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(null); //mock pk1 is not found => therefore handled as new
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([]); //person has no existing PKs
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([]); //CheckRollenartLernSpecification: person has no existing PKs
                rolleRepoMock.findByIds.mockResolvedValueOnce(new Map()); //CheckRollenartLernSpecification
                rolleRepoMock.findByIds.mockResolvedValueOnce(new Map()); //CheckRollenartLernSpecification
                rolleRepoMock.findByIds.mockResolvedValueOnce(new Map());
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); // mock while checking the existing PKs
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);

                const error: Error = new Error('DB Error');
                dBiamPersonenkontextRepoInternalMock.save.mockRejectedValueOnce(error);

                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateResult).toBeInstanceOf(Array);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringMatching(/Personenkontext with \(.*\) could not be added!/),
                    error,
                );
            });
        });

        describe('when sent personenkontexte contain personenkontext with mismatching personId', () => {
            beforeAll(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    faker.string.uuid(),
                    lastModified,
                    count,
                    createPKBodyParams(personId),
                    personPermissionsMock,
                );
            });

            it('should return UpdatePersonIdMismatchError', async () => {
                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();
                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(
                    faker.string.uuid(),
                    DoFactory.createRolle(true, {
                        rollenart: RollenArt.LEHR,
                        merkmale: [RollenMerkmal.KOPERS_PFLICHT],
                    }),
                );
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                expect(updateError).toBeInstanceOf(UpdatePersonIdMismatchError);
            });
        });

        describe('when existing personenkontexte amount does NOT match count', () => {
            beforeAll(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdateCountError', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]); //mock: only one PK is found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdateCountError);
            });
        });

        describe('when most recent updated PK time does not match lastModified time', () => {
            beforeAll(() => {
                const wrongLastModified: Date = faker.date.past();
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    wrongLastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdateOutdatedError', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: both PKs are found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdateOutdatedError);
            });
        });

        describe('when person is not found', () => {
            beforeAll(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdatePersonNotFound', async () => {
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: only one PK is found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdatePersonNotFoundError);
            });
        });

        describe('when person is not found', () => {
            beforeAll(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdatePersonNotFound', async () => {
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: only one PK is found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdatePersonNotFoundError);
            });
        });

        describe('when validate returns no errors', () => {
            beforeEach(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return null asc order', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: both PKs are found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: return the PKs found after update
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock for event

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateResult).toBeInstanceOf(Array);
                expect(dBiamPersonenkontextRepoInternalMock.delete).toHaveBeenCalledTimes(0);
            });

            // This test only test for right sorting by date of PKs, pk2 and pk1 are switched in retrieval order
            it('should return null', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk2, pk1]); //mock: both PKs are found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: return the PKs found after update
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                expect(dBiamPersonenkontextRepoInternalMock.delete).toHaveBeenCalledTimes(0);
                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();
                expect(updateResult).toBeInstanceOf(Array);
            });
        });
        describe('when there are no existing PKs and lastModified is undefined', () => {
            beforeEach(() => {
                const count: number = 0;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    undefined,
                    count,
                    [],
                    personPermissionsMock,
                );
            });

            it('should return empty', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValue([]); // No existing PKs
                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();
                expect(updateResult).toEqual([]);
            });
        });
        describe('when there are existing PKs but lastModified is undefined', () => {
            beforeEach(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    undefined,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdateOutdatedError', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); // Existing PKs
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateResult).toBeInstanceOf(UpdateOutdatedError);
            });
        });

        describe('when permissions are insufficient', () => {
            it('should return MissingPermissionsError if the target person can not be modified', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk2, pk1]); //mock: both PKs are found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: return the PKs found after update

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const permissions: DeepMocked<PersonPermissions> = createMock();
                permissions.canModifyPerson.mockResolvedValueOnce(false);
                const pkUpdate: PersonenkontexteUpdate = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    2,
                    [bodyParam1, bodyParam2],
                    permissions,
                );

                await expect(pkUpdate.update()).resolves.toBeInstanceOf(MissingPermissionsError);
            });

            it('should return MissingPermissionsError if the user can not modify persons at organisation', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValue(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk2, pk1]); //mock: both PKs are found
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]); //mock: return the PKs found after update

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                personRepoMock.findById.mockResolvedValue(undefined);

                const permissions: DeepMocked<PersonPermissions> = createMock();
                permissions.canModifyPerson.mockResolvedValueOnce(true);
                permissions.hasSystemrechtAtOrganisation.mockResolvedValueOnce(false);
                const pkUpdate: PersonenkontexteUpdate = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    2,
                    [bodyParam1, bodyParam2],
                    permissions,
                );

                await expect(pkUpdate.update()).resolves.toBeInstanceOf(MissingPermissionsError);
            });
        });
        describe('when personalnummer is provided', () => {
            it('should update the personalnummer of the person', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                // Mock call before publishing the event
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                // Mock call if the personalnummer exists
                personRepoMock.findById.mockResolvedValueOnce(newPerson);

                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1, pk2]);

                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                    '1234567',
                );
                await sut.update();

                expect(personRepoMock.save).toHaveBeenCalledTimes(1);
            });
        });
        describe('when existing personenkontexte have one personenkontext with rollenart LERN', () => {
            beforeAll(() => {
                const count: number = 2;
                sut = dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
                    personId,
                    lastModified,
                    count,
                    [bodyParam1, bodyParam2],
                    personPermissionsMock,
                );
            });

            it('should return UpdateInvalidRollenartForLernError, if new personenkontext is not a Rolle with rollenart LERN', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdateInvalidRollenartForLernError);
            });
            it('should return UpdateInvalidRollenartForLernError if new personenkontext roles mix LERN with other types', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const mapRollenExisting: Map<string, Rolle<true>> = new Map();
                mapRollenExisting.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenExisting);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(UpdateInvalidRollenartForLernError);
            });
            it('Should not throw any Update invalid Rollenart error', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const mapRollenExisting: Map<string, Rolle<true>> = new Map();
                mapRollenExisting.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));

                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenExisting);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeDefined();
            });
            it('should return PersonenkontextBefristungRequiredError if new personenkontext roles mix LERN with other types', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const mapRollenExisting: Map<string, Rolle<true>> = new Map();
                mapRollenExisting.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenExisting);

                const mapRollenBefristung: Map<string, Rolle<true>> = new Map();
                mapRollenBefristung.set(
                    pk1.rolleId,
                    DoFactory.createRolle(true, {
                        id: pk1.rolleId,
                        rollenart: RollenArt.LERN,
                        merkmale: [RollenMerkmal.BEFRISTUNG_PFLICHT],
                    }),
                );
                mapRollenBefristung.set(
                    pk2.rolleId,
                    DoFactory.createRolle(true, {
                        id: pk2.rolleId,
                        rollenart: RollenArt.LERN,
                        merkmale: [RollenMerkmal.BEFRISTUNG_PFLICHT],
                    }),
                );

                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenBefristung);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenBefristung);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeInstanceOf(PersonenkontextBefristungRequiredError);
            });
            it('Should not throw any PersonenkontextBefristungRequiredError', async () => {
                const newPerson: Person<true> = createMock<Person<true>>();
                personRepoMock.findById.mockResolvedValueOnce(newPerson);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk1);
                dBiamPersonenkontextRepoMock.find.mockResolvedValueOnce(pk2);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);
                dBiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce([pk1]);

                const mapRollen: Map<string, Rolle<true>> = new Map();
                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                const mapRollenExisting: Map<string, Rolle<true>> = new Map();
                mapRollenExisting.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LERN }));

                mapRollen.set(faker.string.uuid(), DoFactory.createRolle(true, { rollenart: RollenArt.LEHR }));

                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollenExisting);
                rolleRepoMock.findByIds.mockResolvedValueOnce(mapRollen);

                jest.spyOn(CheckBefristungSpecification.prototype, 'checkBefristung').mockResolvedValue(true);

                const updateError: Personenkontext<true>[] | PersonenkontexteUpdateError = await sut.update();

                expect(updateError).toBeDefined();
            });
        });
    });
});
