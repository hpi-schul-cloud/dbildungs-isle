import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { Paged } from '../../../shared/paging/paged.js';
import { PagedResponse } from '../../../shared/paging/paged.response.js';
import { Jahrgangsstufe, Personenstatus, Rolle, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { FindPersonenkontextByIdParams } from './param/find-personenkontext-by-id.params.js';
import { PersonApiMapperProfile } from '../../person/api/person-api.mapper.profile.js';
import { PersonendatensatzResponseAutomapper } from '../../person/api/personendatensatz.response-automapper.js';
import { PersonenkontextQueryParams } from './param/personenkontext-query.params.js';
import { PersonenkontextController } from './personenkontext.controller.js';

import { PersonenkontextdatensatzResponse } from './response/personenkontextdatensatz.response.js';
import { UpdatePersonenkontextBodyParams } from './param/update-personenkontext.body.params.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { DeleteRevisionBodyParams } from '../../person/api/delete-revision.body.params.js';
import { PersonByIdParams } from '../../person/api/person-by-id.param.js';
import { HatSystemrechtQueryParams } from './param/hat-systemrecht.query.params.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { SystemrechtResponse } from './response/personenkontext-systemrecht.response.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { DomainError, EntityNotFoundError, MissingPermissionsError } from '../../../shared/error/index.js';
import { OrganisationResponseLegacy } from '../../organisation/api/organisation.response.legacy.js';
import { OrganisationApiMapperProfile } from '../../organisation/api/organisation-api.mapper.profile.js';
import { getMapperToken } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
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
import { PersonRepository } from '../../person/persistence/person.repository.js';

describe('PersonenkontextController', () => {
    let module: TestingModule;
    let sut: PersonenkontextController;
    let personenkontextRepo: DeepMocked<DBiamPersonenkontextRepo>;
    let personenkontextService: DeepMocked<PersonenkontextService>;
    let personService: DeepMocked<PersonService>;
    // let rolleRepo: DeepMocked<RolleRepo>;
    // let organisationRepository: DeepMocked<OrganisationRepository>;
    // let organisationService: DeepMocked<OrganisationService>;
    // let personApiMapper: DeepMocked<PersonApiMapper>;

    let mapper: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonenkontextController,
                PersonApiMapperProfile,
                PersonenkontextService,
                OrganisationApiMapperProfile,
                PersonService,
                RolleRepo,
                OrganisationRepository,
                OrganisationService,
                PersonApiMapper,
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
        }).compile();
        sut = module.get(PersonenkontextController);
        personenkontextRepo = module.get(DBiamPersonenkontextRepo);
        personenkontextService = module.get(PersonenkontextService);
        personService = module.get(PersonService);
        // rolleRepo = module.get(RolleRepo);
        // organisationRepository = module.get(OrganisationRepository);
        // organisationService = module.get(OrganisationService);
        // personApiMapper = module.get(PersonApiMapper);
        mapper = module.get(getMapperToken());
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

                const personenkontextResultMock: Result<Personenkontext<true>, DomainError> = {
                    ok: true,
                    value: createMock<Personenkontext<true>>(),
                };

                const personResultMock: Result<Person<true>, DomainError> = {
                    ok: true,
                    value: createMock<Person<true>>(),
                };

                personenkontextService.findPersonenkontextById.mockResolvedValue(personenkontextResultMock);
                personService.findPersonById.mockResolvedValue(personResultMock);

                const response: PersonendatensatzResponseAutomapper = await sut.findPersonenkontextById(
                    params,
                    permissionsMock,
                );

                expect(response).toBeInstanceOf(PersonendatensatzResponseAutomapper);
                expect(personenkontextService.findPersonenkontextById).toBeCalledTimes(1);
                expect(personService.findPersonById).toBeCalledTimes(1);
            });
        });
    });

    describe('when NOT finding personenkontext with id', () => {
        it('should throw http error', async () => {
            // Mock Auth check
            personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                ok: true,
                value: createMock(),
            });
            const params: FindPersonenkontextByIdParams = {
                personenkontextId: faker.string.uuid(),
            };

            personenkontextService.findPersonenkontextById.mockResolvedValue({
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

    describe('findPersonenkontexte', () => {
        describe('when finding personenkontexte', () => {
            it('should return personenkontext', async () => {
                const queryParams: PersonenkontextQueryParams = {
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.JA,
                    personenstatus: Personenstatus.AKTIV,
                    rolle: Rolle.LERNENDER,
                    offset: 0,
                    limit: 10,
                };
                const mockPersonenkontext: Personenkontext<true> = Personenkontext.construct(
                    createMock<PersonRepository>(),
                    createMock<OrganisationRepository>(),
                    createMock<RolleRepo>(),
                    faker.string.uuid(),
                    new Date(),
                    new Date(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    Personenstatus.AKTIV,
                    Jahrgangsstufe.JAHRGANGSSTUFE_1,
                    SichtfreigabeType.JA,
                    undefined,
                    '1' as Persisted<string, true>,
                );
                const personenkontexte: Paged<Personenkontext<true>> = {
                    offset: queryParams.offset ?? 0,
                    limit: queryParams.limit ?? 1,
                    total: 1,
                    items: [mockPersonenkontext],
                };

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
                permissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue([mockPersonenkontext.organisationId]);
                personenkontextService.findAllPersonenkontexte.mockResolvedValue(personenkontexte);

                const result: PagedResponse<PersonenkontextdatensatzResponse> = await sut.findPersonenkontexte(
                    queryParams,
                    permissionsMock,
                );
                expect(permissionsMock.getOrgIdsWithSystemrecht).toHaveBeenCalledWith(
                    [RollenSystemRecht.PERSONEN_VERWALTEN],
                    true,
                );
                expect(mockPersonenkontext).toBeDefined();
                expect(personenkontextService.findAllPersonenkontexte).toBeCalledTimes(1);
                expect(result.items.length).toBe(1);
                if (result.items[0]) {
                    expect(result.items[0].person.id).toBe(mockPersonenkontext.personId);
                    expect(result.items[0].personenkontexte.length).toBe(1);
                    expect(result.items[0].personenkontexte[0]?.id).toBe(mockPersonenkontext.id);
                }
            });
        });

        describe('hatSystemRecht', () => {
            describe('when verifying user has existing SystemRecht', () => {
                it('should return PersonenkontextSystemrechtResponse', async () => {
                    const idParams: PersonByIdParams = {
                        personId: '1',
                    };
                    const bodyParams: HatSystemrechtQueryParams = {
                        systemRecht: RollenSystemRecht.ROLLEN_VERWALTEN,
                    };
                    const organisations: OrganisationDo<true>[] = [DoFactory.createOrganisation(true)];
                    const organisationResponses: OrganisationResponseLegacy[] = organisations.map(
                        (o: OrganisationDo<true>) => mapper.map(o, OrganisationDo<true>, OrganisationResponseLegacy),
                    );
                    const systemrechtResponse: SystemrechtResponse = {
                        ROLLEN_VERWALTEN: organisationResponses,
                    };
                    personenkontextService.hatSystemRecht.mockResolvedValue(systemrechtResponse);
                    const response: SystemrechtResponse = await sut.hatSystemRecht(idParams, bodyParams);
                    expect(response.ROLLEN_VERWALTEN).toHaveLength(1);
                    expect(personenkontextService.hatSystemRecht).toHaveBeenCalledTimes(1);
                });
            });

            describe('when verifying user has non-existing SystemRecht', () => {
                it('should return 404', async () => {
                    const idParams: PersonByIdParams = {
                        personId: '1',
                    };
                    const bodyParams: HatSystemrechtQueryParams = {
                        systemRecht: 'FALSCHER_RECHTE_NAME',
                    };
                    personenkontextService.hatSystemRecht.mockRejectedValue(new EntityNotFoundError());
                    await expect(sut.hatSystemRecht(idParams, bodyParams)).rejects.toThrow(HttpException);
                    expect(personenkontextService.hatSystemRecht).toHaveBeenCalledTimes(0);
                });
            });
        });

        describe('updatePersonenkontextWithId', () => {
            describe('when updating a personenkontext is successful', () => {
                it('should return PersonenkontextResponse', async () => {
                    // Mock Auth check
                    personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                        ok: true,
                        value: createMock(),
                    });
                    const idParams: FindPersonenkontextByIdParams = {
                        personenkontextId: faker.string.uuid(),
                    };
                    const bodyParams: UpdatePersonenkontextBodyParams = {
                        referrer: 'referrer',
                        personenstatus: Personenstatus.AKTIV,
                        jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                        revision: '1',
                    };
                    const mockResonse: PersonendatensatzDto = {
                        person: new PersonDto(),
                        personenkontexte: [new PersonenkontextDto()],
                    };
                    const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                    personenkontextService.updatePersonenkontext.mockResolvedValue(mockResonse);

                    const response: PersonendatensatzResponseAutomapper = await sut.updatePersonenkontextWithId(
                        idParams,
                        bodyParams,
                        permissionsMock,
                    );

                    expect(response).toBeInstanceOf(PersonendatensatzResponseAutomapper);
                    expect(personenkontextService.updatePersonenkontext).toHaveBeenCalledTimes(1);
                });
            });

            describe('when updating a personenkontext returns a SchulConnexError', () => {
                it('should throw HttpException', async () => {
                    // Mock Auth check
                    personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                        ok: true,
                        value: createMock(),
                    });
                    const idParams: FindPersonenkontextByIdParams = {
                        personenkontextId: faker.string.uuid(),
                    };
                    const bodyParams: UpdatePersonenkontextBodyParams = {
                        referrer: 'referrer',
                        personenstatus: Personenstatus.AKTIV,
                        jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                        revision: '1',
                    };
                    const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                    personenkontextService.updatePersonenkontext.mockResolvedValue(
                        new SchulConnexError({} as SchulConnexError),
                    );

                    await expect(
                        sut.updatePersonenkontextWithId(idParams, bodyParams, permissionsMock),
                    ).rejects.toThrow(HttpException);
                    expect(personenkontextService.updatePersonenkontext).toHaveBeenCalledTimes(1);
                });
            });

            describe('when not authorized', () => {
                it('should throw error', async () => {
                    // Mock Auth check
                    personenkontextRepo.findByIDAuthorized.mockResolvedValueOnce({
                        ok: false,
                        error: new MissingPermissionsError(''),
                    });
                    const idParams: FindPersonenkontextByIdParams = createMock();
                    const bodyParams: UpdatePersonenkontextBodyParams = createMock();
                    const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                    await expect(
                        sut.updatePersonenkontextWithId(idParams, bodyParams, permissionsMock),
                    ).rejects.toThrow(HttpException);
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
                    personenkontextService.deletePersonenkontextById.mockResolvedValue(undefined);
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
                    personenkontextService.deletePersonenkontextById.mockResolvedValue(
                        new SchulConnexError({} as SchulConnexError),
                    );
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
});
