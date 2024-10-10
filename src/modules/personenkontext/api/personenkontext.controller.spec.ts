import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { HttpException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { Paged } from '../../../shared/paging/paged.js';
import { PagedResponse } from '../../../shared/paging/paged.response.js';
import { Personenstatus, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { FindPersonenkontextByIdParams } from './param/find-personenkontext-by-id.params.js';

import { PersonendatensatzResponseAutomapper } from '../../person/api/personendatensatz.response-automapper.js';
import { PersonenkontextQueryParams } from './param/personenkontext-query.params.js';
import { PersonenkontextController } from './personenkontext.controller.js';

import { PersonenkontextdatensatzResponse } from './response/personenkontextdatensatz.response.js';

import { DeleteRevisionBodyParams } from '../../person/api/delete-revision.body.params.js';
import { PersonByIdParams } from '../../person/api/person-by-id.param.js';
import { HatSystemrechtQueryParams } from './param/hat-systemrecht.query.params.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { SystemrechtResponse } from './response/personenkontext-systemrecht.response.js';

import { DomainError, MissingPermissionsError } from '../../../shared/error/index.js';
import { OrganisationResponseLegacy } from '../../organisation/api/organisation.response.legacy.js';

import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextService } from '../domain/personenkontext.service.js';
import { PersonService } from '../../person/domain/person.service.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { Person } from '../../person/domain/person.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { OrganisationService } from '../../organisation/domain/organisation.service.js';
import { PersonApiMapper } from '../../person/mapper/person-api.mapper.js';

import { Organisation } from '../../organisation/domain/organisation.js';

describe('PersonenkontextController', () => {
    let module: TestingModule;
    let sut: PersonenkontextController;
    let personenkontextRepo: DeepMocked<DBiamPersonenkontextRepo>;
    let personenkontextService: DeepMocked<PersonenkontextService>;
    let personService: DeepMocked<PersonService>;
    let rolleRepo: DeepMocked<RolleRepo>;
    let organisationRepository: DeepMocked<OrganisationRepository>;
    let organisationService: DeepMocked<OrganisationService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonenkontextController,
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonenkontextService,
                    useValue: createMock<PersonenkontextService>(),
                },
                {
                    provide: PersonService,
                    useValue: createMock<PersonService>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: OrganisationService,
                    useValue: createMock<OrganisationService>(),
                },
                PersonApiMapper,
            ],
        }).compile();
        sut = module.get(PersonenkontextController);
        personenkontextRepo = module.get(DBiamPersonenkontextRepo);
        personenkontextService = module.get(PersonenkontextService);
        personService = module.get(PersonService);
        rolleRepo = module.get(RolleRepo);
        organisationRepository = module.get(OrganisationRepository);
        organisationService = module.get(OrganisationService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('findPersonenkontextById', () => {
        describe('when finding personenkontext with id', () => {
            it('should return personenkontext response', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock(),
                });

                const params: FindPersonenkontextByIdParams = {
                    personenkontextId: faker.string.uuid(),
                };

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                const personResultMock: Result<Person<true>, DomainError> = {
                    ok: true,
                    value: createMock<Person<true>>(),
                };

                personService.findPersonById.mockResolvedValue(personResultMock);

                const response: PersonendatensatzResponseAutomapper = await sut.findPersonenkontextById(
                    params,
                    permissionsMock,
                );

                expect(response).toBeInstanceOf(PersonendatensatzResponseAutomapper);

                expect(personService.findPersonById).toBeCalledTimes(1);
            });
        });

        describe('when NOT finding personenkontext with id', () => {
            it('should throw http error', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock<Personenkontext<true>>(),
                });
                const params: FindPersonenkontextByIdParams = {
                    personenkontextId: faker.string.uuid(),
                };

                personService.findPersonById.mockResolvedValue({
                    ok: false,
                    error: createMock<DomainError>(),
                });

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                await expect(sut.findPersonenkontextById(params, permissionsMock)).rejects.toThrow(HttpException);
            });

            it('should throw error', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock(),
                });
                const params: FindPersonenkontextByIdParams = {
                    personenkontextId: faker.string.uuid(),
                };
                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                personenkontextService.findPersonenkontextById.mockRejectedValue(new Error());

                await expect(sut.findPersonenkontextById(params, permissionsMock)).rejects.toThrowError(Error);
            });
        });

        describe('when not authorized', () => {
            it('should throw error', async () => {
                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
                const params: FindPersonenkontextByIdParams = {
                    personenkontextId: faker.string.uuid(),
                };
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: false,
                    error: new MissingPermissionsError(''),
                });

                const responsePromise: Promise<unknown> = sut.findPersonenkontextById(params, permissionsMock);

                await expect(responsePromise).rejects.toThrow(HttpException);
            });
        });

        describe('if person is not found', () => {
            it('should throw http error', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock(),
                });

                const params: FindPersonenkontextByIdParams = {
                    personenkontextId: faker.string.uuid(),
                };

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                const personenkontextResultMock: Result<Personenkontext<true>, DomainError> = {
                    ok: true,
                    value: createMock<Personenkontext<true>>(),
                };

                const personResultMock: Result<Person<true>, DomainError> = {
                    ok: false,
                    error: createMock<DomainError>(),
                };

                personenkontextService.findPersonenkontextById.mockResolvedValue(personenkontextResultMock);
                personService.findPersonById.mockResolvedValue(personResultMock);

                await expect(sut.findPersonenkontextById(params, permissionsMock)).rejects.toThrow(HttpException);
            });
        });
    });

    describe('updatePersonenkontextWithId', () => {
        it('should return NotImplemented error', () => {
            expect(() => sut.updatePersonenkontextWithId()).toThrow(NotImplementedException);
        });
    });

    describe('findPersonenkontexte', () => {
        describe('when finding personenkontexte', () => {
            it('should return personenkontext for one allowed organisation', async () => {
                const queryParams: PersonenkontextQueryParams = {
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.JA,
                    personenstatus: Personenstatus.AKTIV,
                    offset: 0,
                    limit: 10,
                };

                const mockPersonenkontext: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    getRolle: () => rolleRepo.findById(faker.string.uuid()),
                });
                const personenkontexte: Paged<Personenkontext<true>> = {
                    offset: queryParams.offset ?? 0,
                    limit: queryParams.limit ?? 1,
                    total: 1,
                    items: [mockPersonenkontext],
                };

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
                permissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                    all: false,
                    orgaIds: [mockPersonenkontext.organisationId],
                });

                personenkontextService.findAllPersonenkontexte.mockResolvedValue(personenkontexte);

                const result: PagedResponse<PersonenkontextdatensatzResponse> = await sut.findPersonenkontexte(
                    queryParams,
                    permissionsMock,
                );

                expect(permissionsMock.getOrgIdsWithSystemrecht).toHaveBeenCalledWith(
                    [RollenSystemRecht.PERSONEN_VERWALTEN],
                    true,
                );
                expect(result.items.length).toBe(1);
                if (result.items[0]) {
                    expect(result.items[0].person.id).toBe(mockPersonenkontext.personId);
                    expect(result.items[0].personenkontexte).toHaveLength(1);
                }
            });

            it('should return personenkontext for root admins', async () => {
                const queryParams: PersonenkontextQueryParams = {
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.JA,
                    personenstatus: Personenstatus.AKTIV,
                    offset: 0,
                    limit: 10,
                };

                const mockPersonenkontext: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    getRolle: () => rolleRepo.findById(faker.string.uuid()),
                });
                const personenkontexte: Paged<Personenkontext<true>> = {
                    offset: queryParams.offset ?? 0,
                    limit: queryParams.limit ?? 1,
                    total: 1,
                    items: [mockPersonenkontext],
                };

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
                permissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                    all: true,
                });

                personenkontextService.findAllPersonenkontexte.mockResolvedValue(personenkontexte);

                const result: PagedResponse<PersonenkontextdatensatzResponse> = await sut.findPersonenkontexte(
                    queryParams,
                    permissionsMock,
                );

                expect(permissionsMock.getOrgIdsWithSystemrecht).toHaveBeenCalledWith(
                    [RollenSystemRecht.PERSONEN_VERWALTEN],
                    true,
                );
                expect(result.items.length).toBe(1);
                if (result.items[0]) {
                    expect(result.items[0].person.id).toBe(mockPersonenkontext.personId);
                    expect(result.items[0].personenkontexte).toHaveLength(1);
                }
            });
        });
    });

    describe('hatSystemRecht', () => {
        describe('when verifying user has existing SystemRecht', () => {
            it('should return SystemrechtResponse', async () => {
                const idParams: PersonByIdParams = { personId: '1' };
                const bodyParams: HatSystemrechtQueryParams = {
                    systemRecht: RollenSystemRecht.ROLLEN_VERWALTEN,
                };

                const organisations: Organisation<true>[] = [
                    DoFactory.createOrganisation(true, {
                        id: 'org1',
                        name: 'Organisation 1',
                    }),
                ];

                const organisationResponses: OrganisationResponseLegacy[] = organisations.map(
                    (org: Organisation<true>) => new OrganisationResponseLegacy(org),
                );
                const systemrechtResponse: SystemrechtResponse = {
                    ROLLEN_VERWALTEN: organisationResponses,
                };

                personenkontextService.findPersonenkontexteByPersonId.mockResolvedValueOnce([
                    DoFactory.createPersonenkontext(true, { rolleId: 'rolle1', organisationId: 'org1' }),
                    DoFactory.createPersonenkontext(true, { rolleId: 'rolle2', organisationId: 'org2' }),
                ]);
                rolleRepo.findById
                    .mockResolvedValueOnce(DoFactory.createRolle(true, { hasSystemRecht: () => true }))
                    .mockResolvedValueOnce(undefined);
                organisationRepository.findById.mockResolvedValue(organisations[0]);
                const pagedOrgas: Paged<Organisation<true>> = {
                    offset: 0,
                    limit: 0,
                    total: 0,
                    items: [],
                };
                organisationService.findAllAdministriertVon.mockResolvedValue(pagedOrgas);

                const response: SystemrechtResponse = await sut.hatSystemRecht(idParams, bodyParams);
                expect(response).toEqual(systemrechtResponse);
                expect(response.ROLLEN_VERWALTEN).toHaveLength(1);
                expect(personenkontextService.findPersonenkontexteByPersonId).toHaveBeenCalledTimes(1);
                expect(rolleRepo.findById).toHaveBeenCalledTimes(2);
                expect(organisationRepository.findById).toHaveBeenCalledTimes(1);
                expect(organisationService.findAllAdministriertVon).toHaveBeenCalledTimes(1);
            });
        });

        describe('when verifying user has non-existing SystemRecht', () => {
            it('should return 404', async () => {
                const idParams: PersonByIdParams = {
                    personId: '1',
                };
                const queryParams: HatSystemrechtQueryParams = {
                    systemRecht: 'FALSCHER_RECHTE_NAME',
                };

                await expect(sut.hatSystemRecht(idParams, queryParams)).rejects.toThrow(HttpException);
            });
        });
    });

    describe('deletePersonenkontextById', () => {
        const idParams: FindPersonenkontextByIdParams = {
            personenkontextId: faker.string.uuid(),
        };

        const bodyParams: DeleteRevisionBodyParams = {
            revision: '1',
        };

        describe('when deleting a personenkontext is successful', () => {
            it('should return nothing', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock(),
                });
                personenkontextService.deletePersonenkontextById.mockResolvedValue({
                    ok: true,
                    value: undefined,
                });
                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                const response: void = await sut.deletePersonenkontextById(idParams, bodyParams, permissionsMock);

                expect(response).toBeUndefined();
                expect(personenkontextService.deletePersonenkontextById).toHaveBeenCalledTimes(1);
            });
        });

        describe('when deleting a personenkontext returns a SchulConnexError', () => {
            it('should throw HttpException', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: true,
                    value: createMock(),
                });
                personenkontextService.deletePersonenkontextById.mockResolvedValue({
                    ok: false,
                    error: new MissingPermissionsError(''),
                });
                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                await expect(sut.deletePersonenkontextById(idParams, bodyParams, permissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personenkontextService.deletePersonenkontextById).toHaveBeenCalledTimes(1);
            });
        });

        describe('when not authorized', () => {
            it('should throw error', async () => {
                // Mock Auth check
                personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                    ok: false,
                    error: new MissingPermissionsError(''),
                });
                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                await expect(sut.deletePersonenkontextById(idParams, bodyParams, permissionsMock)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });
});
