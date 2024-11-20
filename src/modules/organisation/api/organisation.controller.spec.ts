import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DoFactory, ConfigTestModule } from '../../../../test/utils/index.js';
import { Paged } from '../../../shared/paging/paged.js';
import { OrganisationsTyp, Traegerschaft } from '../domain/organisation.enums.js';
import { CreateOrganisationBodyParams } from './create-organisation.body.params.js';
import { FindOrganisationQueryParams } from './find-organisation-query.param.js';
import { OrganisationByIdParams } from './organisation-by-id.params.js';
import { OrganisationController } from './organisation.controller.js';
import { OrganisationResponseLegacy } from './organisation.response.legacy.js';
import { UpdateOrganisationBodyParams } from './update-organisation.body.params.js';
import { OrganisationByIdBodyParams } from './organisation-by-id.body.params.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { Organisation } from '../domain/organisation.js';
import { OrganisationResponse } from './organisation.response.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { EventService } from '../../../core/eventbus/index.js';
import { OrganisationRootChildrenResponse } from './organisation.root-children.response.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { OrganisationByNameBodyParams } from './organisation-by-name.body.params.js';
import { NameRequiredForKlasseError } from '../specification/error/name-required-for-klasse.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { OrganisationService } from '../domain/organisation.service.js';

import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';
import { OrganisationByNameQueryParams } from './organisation-by-name.query.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { ParentOrganisationenResponse } from './organisation.parents.response.js';
import { ParentOrganisationsByIdsBodyParams } from './parent-organisations-by-ids.body.params.js';

function getFakeParamsAndBody(): [OrganisationByIdParams, OrganisationByIdBodyParams] {
    const params: OrganisationByIdParams = {
        organisationId: faker.string.uuid(),
    };
    const body: OrganisationByIdBodyParams = {
        organisationId: faker.string.uuid(),
    };
    return [params, body];
}

describe('OrganisationController', () => {
    let module: TestingModule;
    let organisationController: OrganisationController;
    let organisationServiceMock: DeepMocked<OrganisationService>;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                OrganisationController,
                {
                    provide: OrganisationService,
                    useValue: createMock<OrganisationService>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
        }).compile();
        organisationController = module.get(OrganisationController);
        organisationServiceMock = module.get(OrganisationService);
        organisationRepositoryMock = module.get(OrganisationRepository);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(organisationController).toBeDefined();
    });

    describe('createOrganisation', () => {
        describe('when usecase returns a DTO', () => {
            it('should not throw an error', async () => {
                const params: CreateOrganisationBodyParams = {
                    kennung: faker.lorem.word(),
                    name: faker.lorem.word(),
                    namensergaenzung: faker.lorem.word(),
                    kuerzel: faker.lorem.word(),
                    typ: OrganisationsTyp.SONSTIGE,
                    traegerschaft: Traegerschaft.SONSTIGE,
                };
                const returnedValue: Organisation<true> = DoFactory.createOrganisation(true);

                organisationServiceMock.createOrganisation.mockResolvedValueOnce({ ok: true, value: returnedValue });
                await expect(organisationController.createOrganisation(params)).resolves.not.toThrow();
                expect(organisationServiceMock.createOrganisation).toHaveBeenCalledTimes(1);
            });
        });
        it('should throw an error if Organisation.createNew returns a DomainError', async () => {
            const params: CreateOrganisationBodyParams = {
                administriertVon: faker.string.uuid(),
                zugehoerigZu: faker.string.uuid(),
                kennung: ' Test', // This should trigger the error
                name: faker.lorem.word(),
                namensergaenzung: faker.lorem.word(),
                kuerzel: faker.lorem.word(),
                typ: OrganisationsTyp.ANBIETER,
                traegerschaft: undefined,
            };

            const oeffentlich: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.numeric(),
                'Öffentliche Schulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );
            const ersatz: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.numeric(),
                'Ersatzschulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            const mockedRepoResponse: [Organisation<true> | undefined, Organisation<true> | undefined] = [
                oeffentlich,
                ersatz,
            ];

            organisationRepositoryMock.findRootDirectChildren.mockResolvedValue(mockedRepoResponse);

            try {
                await organisationController.createOrganisation(params);

                fail('Expected error was not thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(KennungForOrganisationWithTrailingSpaceError);
            }
        });

        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                const oeffentlich: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Öffentliche Schulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                    undefined,
                );
                const ersatz: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Ersatzschulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                const mockedRepoResponse: [Organisation<true> | undefined, Organisation<true> | undefined] = [
                    oeffentlich,
                    ersatz,
                ];

                organisationRepositoryMock.findRootDirectChildren.mockResolvedValue(mockedRepoResponse);
                organisationServiceMock.createOrganisation.mockResolvedValueOnce({
                    ok: false,
                    error: new OrganisationSpecificationError('error', undefined),
                });
                await expect(
                    organisationController.createOrganisation({} as CreateOrganisationBodyParams),
                ).rejects.toThrow(OrganisationSpecificationError);
                expect(organisationServiceMock.createOrganisation).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                const oeffentlich: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Öffentliche Schulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                    undefined,
                );
                const ersatz: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Ersatzschulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                const mockedRepoResponse: [Organisation<true> | undefined, Organisation<true> | undefined] = [
                    oeffentlich,
                    ersatz,
                ];

                organisationRepositoryMock.findRootDirectChildren.mockResolvedValue(mockedRepoResponse);
                organisationServiceMock.createOrganisation.mockResolvedValue({
                    ok: false,
                    error: {} as EntityNotFoundError,
                });
                await expect(
                    organisationController.createOrganisation({} as CreateOrganisationBodyParams),
                ).rejects.toThrow(HttpException);
                expect(organisationServiceMock.createOrganisation).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('updateOrganisation', () => {
        describe('when usecase returns a DTO', () => {
            it('should not throw an error', async () => {
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };

                const body: UpdateOrganisationBodyParams = {
                    kennung: faker.lorem.word(),
                    name: faker.lorem.word(),
                    namensergaenzung: faker.lorem.word(),
                    kuerzel: faker.lorem.word(),
                    typ: OrganisationsTyp.SONSTIGE,
                    traegerschaft: Traegerschaft.SONSTIGE,
                    administriertVon: faker.lorem.word(),
                    zugehoerigZu: faker.lorem.word(),
                };
                const returnedValue: Organisation<true> = DoFactory.createOrganisation(true);

                organisationServiceMock.updateOrganisation.mockResolvedValue({ ok: true, value: returnedValue });
                await expect(organisationController.updateOrganisation(params, body)).resolves.not.toThrow();
                expect(organisationServiceMock.updateOrganisation).toHaveBeenCalledTimes(1);
            });
        });
        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
                organisationServiceMock.updateOrganisation.mockResolvedValue({
                    ok: false,
                    error: new OrganisationSpecificationError('error', undefined),
                });
                await expect(
                    organisationController.updateOrganisation(
                        { organisationId: faker.string.uuid() } as OrganisationByIdParams,
                        {} as UpdateOrganisationBodyParams,
                    ),
                ).rejects.toThrow(OrganisationSpecificationError);
                expect(organisationServiceMock.updateOrganisation).toHaveBeenCalledTimes(1);
            });
        });
        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
                organisationServiceMock.updateOrganisation.mockResolvedValue({
                    ok: false,
                    error: {} as EntityNotFoundError,
                });
                await expect(
                    organisationController.updateOrganisation(
                        { organisationId: faker.string.uuid() } as OrganisationByIdParams,
                        {} as UpdateOrganisationBodyParams,
                    ),
                ).rejects.toThrow(HttpException);
                expect(organisationServiceMock.updateOrganisation).toHaveBeenCalledTimes(1);
            });
        });
        describe('when organisation is not found', () => {
            it('should throw a NotFoundException', async () => {
                const organisationId: string = faker.string.uuid();
                organisationRepositoryMock.findById.mockResolvedValueOnce(null);
                await expect(
                    organisationController.updateOrganisation(
                        { organisationId: organisationId } as OrganisationByIdParams,
                        {} as UpdateOrganisationBodyParams,
                    ),
                ).rejects.toThrow(new NotFoundException(`Organisation with ID ${organisationId} not found`));
                expect(organisationRepositoryMock.findById).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('findOrganisationById', () => {
        const params: OrganisationByIdParams = {
            organisationId: faker.string.uuid(),
        };

        describe('when usecase returns an OrganisationResponse', () => {
            it('should not throw', async () => {
                const response: Organisation<true> = DoFactory.createOrganisation(true);

                organisationServiceMock.findOrganisationById.mockResolvedValue({ ok: true, value: response });
                await expect(organisationController.findOrganisationById(params)).resolves.not.toThrow();
                expect(organisationServiceMock.findOrganisationById).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw HttpException', async () => {
                organisationServiceMock.findOrganisationById.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError(),
                });
                await expect(organisationController.findOrganisationById(params)).rejects.toThrow(HttpException);
                expect(organisationServiceMock.findOrganisationById).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('findOrganizations', () => {
        describe('when finding organizations with given query params', () => {
            it('should find all organizations that match and handle provided IDs', async () => {
                const organisationIds: string[] = [faker.string.uuid(), faker.string.uuid()];

                const queryParams: FindOrganisationQueryParams = {
                    typ: OrganisationsTyp.SONSTIGE,
                    searchString: faker.lorem.word(),
                    systemrechte: [],
                    administriertVon: [faker.string.uuid(), faker.string.uuid()],
                    // Assuming you have a field for organisationIds in your query params
                    organisationIds: organisationIds,
                };

                const selectedOrganisationMap: Map<string, Organisation<true>> = new Map(
                    organisationIds.map((id: string) => [
                        id,
                        DoFactory.createOrganisationAggregate(true, {
                            id: id,
                            createdAt: faker.date.recent(),
                            updatedAt: faker.date.recent(),
                            administriertVon: faker.string.uuid(),
                            zugehoerigZu: faker.string.uuid(),
                            kennung: faker.lorem.word(),
                            name: faker.lorem.word(),
                            namensergaenzung: faker.lorem.word(),
                            kuerzel: faker.lorem.word(),
                            typ: OrganisationsTyp.SCHULE,
                            traegerschaft: Traegerschaft.LAND,
                        }),
                    ]),
                );

                const mockedRepoResponse: [Organisation<true>[], number, number] = [
                    [
                        DoFactory.createOrganisationAggregate(true, {
                            id: faker.string.uuid(),
                            createdAt: faker.date.recent(),
                            updatedAt: faker.date.recent(),
                            administriertVon: faker.string.uuid(),
                            zugehoerigZu: faker.string.uuid(),
                            kennung: faker.lorem.word(),
                            name: faker.lorem.word(),
                            namensergaenzung: faker.lorem.word(),
                            kuerzel: faker.lorem.word(),
                            typ: OrganisationsTyp.SCHULE,
                            traegerschaft: Traegerschaft.LAND,
                        }),
                        ...selectedOrganisationMap.values(),
                    ],
                    selectedOrganisationMap.size + 1,
                    3,
                ];

                const permissionsMock: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();

                organisationRepositoryMock.findAuthorized.mockResolvedValue(mockedRepoResponse);

                const result: Paged<OrganisationResponse> = await organisationController.findOrganizations(
                    queryParams,
                    permissionsMock,
                );

                expect(organisationRepositoryMock.findAuthorized).toHaveBeenCalledTimes(1);

                expect(result.items.length).toEqual(3);
            });
        });
    });

    describe('getRootChildren', () => {
        describe('when both oeffentlich & ersatz could be found', () => {
            it('should return offentliche & ersatz organisation', async () => {
                const oeffentlich: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Öffentliche Schulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                    undefined,
                );
                const ersatz: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Ersatzschulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                const mockedRepoResponse: [Organisation<true> | undefined, Organisation<true> | undefined] = [
                    oeffentlich,
                    ersatz,
                ];

                organisationRepositoryMock.findRootDirectChildren.mockResolvedValue(mockedRepoResponse);

                const result: OrganisationRootChildrenResponse = await organisationController.getRootChildren();

                expect(organisationRepositoryMock.findRootDirectChildren).toHaveBeenCalledTimes(1);
                expect(result).toBeInstanceOf(OrganisationRootChildrenResponse);
                expect(result.ersatz).toEqual(new OrganisationResponse(ersatz));
                expect(result.oeffentlich).toEqual(new OrganisationResponse(oeffentlich));
            });
        });
        describe('when oeffentlich || ersatz could not be found', () => {
            it('should return an error', async () => {
                const mockedRepoResponse: [Organisation<true> | undefined, Organisation<true> | undefined] = [
                    undefined,
                    undefined,
                ];

                organisationRepositoryMock.findRootDirectChildren.mockResolvedValue(mockedRepoResponse);

                await expect(organisationController.getRootChildren()).rejects.toThrow(HttpException);
            });
        });
    });

    describe('getParents', () => {
        it('should return the parent organisations', async () => {
            const ids: Array<string> = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
            const mockBody: ParentOrganisationsByIdsBodyParams = { organisationIds: ids };
            const mockedRepoResponse: Array<Organisation<true>> = ids.map((id: string) =>
                Organisation.construct(
                    id,
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    faker.lorem.word(),
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                ),
            );
            organisationRepositoryMock.findParentOrgasForIds.mockResolvedValue(mockedRepoResponse);

            const result: ParentOrganisationenResponse = await organisationController.getParentsByIds(mockBody);

            expect(organisationRepositoryMock.findParentOrgasForIds).toHaveBeenCalledTimes(1);
            expect(organisationRepositoryMock.findParentOrgasForIds).toHaveBeenCalledWith(ids);
            expect(result).toBeInstanceOf(ParentOrganisationenResponse);
            expect(result.parents[0]?.id).toBe(ids[0]);
        });
    });

    describe('getRootOrganisation', () => {
        it('should return the root organisation if it exists', async () => {
            const response: Organisation<true> = DoFactory.createOrganisation(true);

            organisationServiceMock.findOrganisationById.mockResolvedValue({ ok: true, value: response });
            await expect(organisationController.getRootOrganisation()).resolves.not.toThrow();
            expect(organisationServiceMock.findOrganisationById).toHaveBeenCalledTimes(1);
        });

        it('should throw an error', async () => {
            organisationServiceMock.findOrganisationById.mockResolvedValue({
                ok: false,
                error: new EntityNotFoundError(),
            });
            await expect(organisationController.getRootOrganisation()).rejects.toThrow(HttpException);
            expect(organisationServiceMock.findOrganisationById).toHaveBeenCalledTimes(1);
        });
    });

    describe('getAdministrierteOrganisationen', () => {
        const routeParams: OrganisationByIdParams = {
            organisationId: faker.string.uuid(),
        };

        const queryParams: OrganisationByNameQueryParams = {
            searchFilter: undefined,
        };

        describe('when usecase returns a OrganisationResponse', () => {
            it('should return all organizations that match', async () => {
                const organisations: Paged<Organisation<true>> = {
                    items: [DoFactory.createOrganisation(true), DoFactory.createOrganisation(true)],
                    limit: 10,
                    offset: 0,
                    total: 2,
                    pageTotal: 2,
                };
                const organisatonResponse: OrganisationResponse[] = organisations.items.map(
                    (item: Organisation<true>) => new OrganisationResponse(item),
                );
                organisationServiceMock.findOrganisationById.mockResolvedValue({
                    ok: true,
                    value: DoFactory.createOrganisation(true),
                });
                organisationServiceMock.findAllAdministriertVon.mockResolvedValueOnce(organisations);

                const result: Paged<OrganisationResponseLegacy> =
                    await organisationController.getAdministrierteOrganisationen(routeParams, queryParams);

                expect(result.items).toMatchObject(organisatonResponse);
                expect(organisationServiceMock.findAllAdministriertVon).toHaveBeenCalledTimes(1);
                expect(result.items.length).toEqual(2);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException if parent organisation is not found', async () => {
                organisationServiceMock.findOrganisationById.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError(),
                });

                await expect(
                    organisationController.getAdministrierteOrganisationen(routeParams, queryParams),
                ).rejects.toThrow(HttpException);
            });
        });
    });

    describe('getZugehoerigeOrganisationen', () => {
        const params: OrganisationByIdParams = {
            organisationId: faker.string.uuid(),
        };

        describe('when usecase returns a OrganisationResponse', () => {
            it('should return all organizations that match', async () => {
                const organisations: Paged<Organisation<true>> = {
                    items: [DoFactory.createOrganisation(true), DoFactory.createOrganisation(true)],
                    limit: 10,
                    offset: 0,
                    total: 2,
                    pageTotal: 2,
                };
                const organisatonResponse: OrganisationResponse[] = organisations.items.map(
                    (item: Organisation<true>) => new OrganisationResponse(item),
                );
                organisationServiceMock.findOrganisationById.mockResolvedValue({
                    ok: true,
                    value: DoFactory.createOrganisation(true),
                });
                organisationServiceMock.findAllZugehoerigZu.mockResolvedValue(organisations);

                const result: Paged<OrganisationResponseLegacy> =
                    await organisationController.getZugehoerigeOrganisationen(params);

                expect(result.items).toEqual(organisatonResponse);
                expect(organisationServiceMock.findAllZugehoerigZu).toHaveBeenCalledTimes(1);
                expect(result.items.length).toEqual(2);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException if parent organisation is not found', async () => {
                organisationServiceMock.findOrganisationById.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });
                await expect(organisationController.getZugehoerigeOrganisationen(params)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });

    describe('addAdministrierteOrganisation', () => {
        describe('when usecase succeeds', () => {
            it('should not throw an error', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setAdministriertVon.mockResolvedValue({ ok: true, value: undefined });

                await expect(organisationController.addAdministrierteOrganisation(params, body)).resolves.not.toThrow();
                expect(organisationServiceMock.setAdministriertVon).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setAdministriertVon.mockResolvedValue({
                    ok: false,
                    error: new OrganisationSpecificationError('error', undefined),
                });
                await expect(organisationController.addAdministrierteOrganisation(params, body)).rejects.toThrow(
                    OrganisationSpecificationError,
                );

                expect(organisationServiceMock.setAdministriertVon).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setAdministriertVon.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError('Organisation', undefined),
                });
                await expect(organisationController.addAdministrierteOrganisation(params, body)).rejects.toThrow(
                    HttpException,
                );

                expect(organisationServiceMock.setAdministriertVon).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('addZugehoerigeOrganisation', () => {
        describe('when usecase succeeds', () => {
            it('should not throw an error', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setZugehoerigZu.mockResolvedValue({ ok: true, value: undefined });

                await expect(organisationController.addZugehoerigeOrganisation(params, body)).resolves.not.toThrow();
                expect(organisationServiceMock.setZugehoerigZu).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setZugehoerigZu.mockResolvedValue({
                    ok: false,
                    error: new OrganisationSpecificationError('error', undefined),
                });
                await expect(organisationController.addZugehoerigeOrganisation(params, body)).rejects.toThrow(
                    OrganisationSpecificationError,
                );

                expect(organisationServiceMock.setZugehoerigZu).toHaveBeenCalledTimes(1);
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                const [params, body]: [OrganisationByIdParams, OrganisationByIdBodyParams] = getFakeParamsAndBody();

                organisationServiceMock.setZugehoerigZu.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError('Organisation', undefined),
                });
                await expect(organisationController.addZugehoerigeOrganisation(params, body)).rejects.toThrow(
                    HttpException,
                );

                expect(organisationServiceMock.setZugehoerigZu).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('updateOrganisationName', () => {
        describe('when usecase succeeds', () => {
            it('should not throw an error', async () => {
                const oeffentlich: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Öffentliche Schulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                    undefined,
                );
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };

                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(oeffentlich);

                await expect(organisationController.updateOrganisationName(params, body)).resolves.not.toThrow();
            });
        });

        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };
                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(new NameRequiredForKlasseError());

                await expect(organisationController.updateOrganisationName(params, body)).rejects.toThrow(
                    NameRequiredForKlasseError,
                );
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };

                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(new EntityNotFoundError());

                await expect(organisationController.updateOrganisationName(params, body)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });

    describe('updateOrganisationName', () => {
        describe('when usecase succeeds', () => {
            it('should not throw an error', async () => {
                const oeffentlich: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Öffentliche Schulen Land Schleswig-Holstein',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.ROOT,
                    undefined,
                );
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };

                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(oeffentlich);

                await expect(organisationController.updateOrganisationName(params, body)).resolves.not.toThrow();
            });
        });

        describe('when usecase returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };
                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(new NameRequiredForKlasseError());

                await expect(organisationController.updateOrganisationName(params, body)).rejects.toThrow(
                    NameRequiredForKlasseError,
                );
            });
        });

        describe('when usecase returns a SchulConnexError', () => {
            it('should throw a HttpException', async () => {
                const params: OrganisationByIdParams = {
                    organisationId: faker.string.uuid(),
                };
                const body: OrganisationByNameBodyParams = {
                    name: faker.company.name(),
                    version: faker.number.int(),
                };

                organisationRepositoryMock.updateKlassenname.mockResolvedValueOnce(new EntityNotFoundError());

                await expect(organisationController.updateOrganisationName(params, body)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });

    describe('enableForItsLearning', () => {
        let params: OrganisationByIdParams;
        let permissionsMock: DeepMocked<PersonPermissions>;

        beforeAll(() => {
            params = {
                organisationId: faker.string.uuid(),
            };
            permissionsMock = createMock<PersonPermissions>();
        });
        describe('when enabling ITSLearning succeeds for organisation', () => {
            it('should not throw an error', async () => {
                const schule: Organisation<true> = Organisation.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    faker.number.int(),
                    faker.string.uuid(),
                    faker.string.uuid(),
                    faker.string.numeric(),
                    'Schule',
                    faker.lorem.word(),
                    faker.string.uuid(),
                    OrganisationsTyp.SCHULE,
                    undefined,
                );
                organisationRepositoryMock.setEnabledForitslearning.mockResolvedValueOnce(schule);

                await expect(
                    organisationController.enableForitslearning(params, permissionsMock),
                ).resolves.not.toThrow();
            });
        });
        describe('when enabling ITSLearning for organisation returns a OrganisationSpecificationError', () => {
            it('should throw a HttpException', async () => {
                organisationRepositoryMock.setEnabledForitslearning.mockResolvedValueOnce(
                    new NameRequiredForKlasseError(),
                );

                await expect(organisationController.enableForitslearning(params, permissionsMock)).rejects.toThrow(
                    NameRequiredForKlasseError,
                );
            });
        });

        describe('when enabling ITSLearning for organisation returns a SchulConnexError or any Non-Specificatin-Error', () => {
            it('should throw a HttpException', async () => {
                organisationRepositoryMock.setEnabledForitslearning.mockResolvedValueOnce(new EntityNotFoundError());

                await expect(organisationController.enableForitslearning(params, permissionsMock)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });
});
