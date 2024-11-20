import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { CallHandler, ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DoFactory,
    KeycloakConfigTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';
import { OrganisationEntity } from '../../organisation/persistence/organisation.entity.js';
import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../domain/rolle.enums.js';
import { RolleEntity } from '../entity/rolle.entity.js';
import { RolleRepo } from '../repo/rolle.repo.js';
import { RolleApiModule } from '../rolle-api.module.js';
import { CreateRolleBodyParams } from './create-rolle.body.params.js';
import { RolleResponse } from './rolle.response.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { AddSystemrechtBodyParams } from './add-systemrecht.body.params.js';
import { Rolle } from '../domain/rolle.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { RolleWithServiceProvidersResponse } from './rolle-with-serviceprovider.response.js';
import { PagedResponse } from '../../../shared/paging/index.js';
import { ServiceProviderIdNameResponse } from './serviceprovider-id-name.response.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PersonPermissionsRepo } from '../../authentication/domain/person-permission.repo.js';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { PassportUser } from '../../authentication/types/user.js';
import { UpdateRolleBodyParams } from './update-rolle.body.params.js';

import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { DBiamPersonenkontextRepoInternal } from '../../personenkontext/persistence/internal-dbiam-personenkontext.repo.js';

import { PersonRepository } from '../../person/persistence/person.repository.js';
import { KeycloakUserService } from '../../keycloak-administration/domain/keycloak-user.service.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Person } from '../../person/domain/person.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { KeycloakConfigModule } from '../../keycloak-administration/keycloak-config.module.js';
import { RolleServiceProviderBodyParams } from './rolle-service-provider.body.params.js';
import { generatePassword } from '../../../shared/util/password-generator.js';
import { DbiamRolleError } from './dbiam-rolle.error.js';

describe('Rolle API', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let rolleRepo: RolleRepo;
    let personRepo: PersonRepository;
    let serviceProviderRepo: ServiceProviderRepo;
    let dBiamPersonenkontextRepoInternal: DBiamPersonenkontextRepoInternal;
    let personpermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;
    let personPermissionsMock: DeepMocked<PersonPermissions>;
    let personFactory: PersonFactory;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                RolleApiModule,
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                MapperTestModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
                {
                    provide: APP_INTERCEPTOR,
                    useValue: {
                        intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
                            const req: Request = context.switchToHttp().getRequest();
                            req.passportUser = createMock<PassportUser>({
                                async personPermissions() {
                                    return personpermissionsRepoMock.loadPersonPermissions('');
                                },
                            });
                            return next.handle();
                        },
                    },
                },
                {
                    provide: PersonPermissionsRepo,
                    useValue: createMock<PersonPermissionsRepo>(),
                },
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
        })
            .overrideModule(KeycloakConfigModule)
            .useModule(KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }))
            .compile();

        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        rolleRepo = module.get(RolleRepo);
        personRepo = module.get(PersonRepository);
        serviceProviderRepo = module.get(ServiceProviderRepo);
        personFactory = module.get(PersonFactory);

        dBiamPersonenkontextRepoInternal = module.get(DBiamPersonenkontextRepoInternal);
        personpermissionsRepoMock = module.get(PersonPermissionsRepo);

        personPermissionsMock = createMock<PersonPermissions>();
        personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personPermissionsMock);
        personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds: [] });
        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
        app = module.createNestApplication();
        await app.init();
    }, 10000000);

    afterAll(async () => {
        await orm.close();
        await app.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    describe('/POST rolle', () => {
        it('should return created rolle', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(expect.objectContaining(params));
        });

        it('should save rolle to db', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);
            const rolle: RolleResponse = response.body as RolleResponse;

            await em.findOneOrFail(RolleEntity, { id: rolle.id });
        });

        it('should fail if the organisation does not exist', async () => {
            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: faker.string.uuid(),
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);

            expect(response.status).toBe(404);
        });

        it('should fail if rollenart is invalid', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: 'INVALID' as RollenArt,
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);

            expect(response.status).toBe(400);
        });

        it('should fail if merkmal is invalid', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: ['INVALID' as RollenMerkmal],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);

            expect(response.status).toBe(400);
        });

        it('should fail if merkmale are not unique', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            const params: CreateRolleBodyParams = {
                name: faker.person.jobTitle(),
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: [RollenMerkmal.BEFRISTUNG_PFLICHT, RollenMerkmal.BEFRISTUNG_PFLICHT],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);

            expect(response.status).toBe(400);
        });

        it('should fail Rolle-Name-Unique-On-SSK specification is violated', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            const rolleName: string = faker.person.jobTitle();
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    name: rolleName,
                }),
            );
            if (rolle instanceof DomainError) throw Error();

            const params: CreateRolleBodyParams = {
                name: rolleName,
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: faker.helpers.enumValue(RollenArt),
                merkmale: [],
                systemrechte: [],
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/rolle')
                .send(params);
            const responseBody: DbiamRolleError = response.body as DbiamRolleError;

            expect(response.status).toBe(400);
            expect(responseBody.i18nKey).toStrictEqual('ROLLE_NAME_UNIQUE_ON_SSK');
            expect(responseBody.code).toStrictEqual(400);
        });
    });

    describe('/GET rollen', () => {
        it('should return all rollen', async () => {
            const orgaIds: string[] = (
                await Promise.all([
                    rolleRepo.save(DoFactory.createRolle(false)),
                    rolleRepo.save(DoFactory.createRolle(false)),
                    rolleRepo.save(DoFactory.createRolle(false)),
                ])
            ).map((r: Rolle<true> | DomainError) => {
                if (r instanceof DomainError) {
                    throw Error();
                }
                return r.administeredBySchulstrukturknoten;
            });

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds });

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const pagedResponse: PagedResponse<RolleWithServiceProvidersResponse> =
                response.body as PagedResponse<RolleWithServiceProvidersResponse>;
            expect(pagedResponse.items).toHaveLength(3);
        });

        it('should return no rollen', async () => {
            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const pagedResponse: PagedResponse<RolleWithServiceProvidersResponse> =
                response.body as PagedResponse<RolleWithServiceProvidersResponse>;
            expect(pagedResponse.items).toHaveLength(0);
        });

        it('should return rollen with the given queried name', async () => {
            const testRolle: { name: string; administeredBySchulstrukturknoten: string } | DomainError =
                await rolleRepo.save(DoFactory.createRolle(false));
            if (testRolle instanceof DomainError) throw Error();

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [testRolle.administeredBySchulstrukturknoten],
            });

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .query({ searchStr: testRolle.name })
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const pagedResponse: PagedResponse<RolleWithServiceProvidersResponse> =
                response.body as PagedResponse<RolleWithServiceProvidersResponse>;
            expect(pagedResponse.items).toHaveLength(1);
            expect(pagedResponse.items).toContainEqual(expect.objectContaining({ name: testRolle.name }));
        });

        it('should return rollen with serviceproviders', async () => {
            const [sp1, sp2, sp3]: [ServiceProvider<true>, ServiceProvider<true>, ServiceProvider<true>] =
                await Promise.all([
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                ]);

            const orgaIds: string[] = (
                await Promise.all([
                    rolleRepo.save(DoFactory.createRolle(false, { serviceProviderIds: [sp1.id] })),
                    rolleRepo.save(DoFactory.createRolle(false, { serviceProviderIds: [sp2.id, sp3.id] })),
                    rolleRepo.save(DoFactory.createRolle(false)),
                ])
            ).map((r: Rolle<true> | DomainError) => {
                if (r instanceof DomainError) {
                    throw new Error();
                }
                return r.administeredBySchulstrukturknoten;
            });

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds });

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const pagedResponse: PagedResponse<RolleWithServiceProvidersResponse> =
                response.body as PagedResponse<RolleWithServiceProvidersResponse>;
            expect(pagedResponse.items).toHaveLength(3);

            pagedResponse.items.forEach((item: RolleWithServiceProvidersResponse) => {
                item.serviceProviders.sort((a: ServiceProviderIdNameResponse, b: ServiceProviderIdNameResponse) =>
                    a.id.localeCompare(b.id),
                );
            });

            expect(pagedResponse.items).toContainEqual(
                expect.objectContaining({ serviceProviders: [{ id: sp1.id, name: sp1.name }] }),
            );
            expect(pagedResponse.items).toContainEqual(
                expect.objectContaining({
                    serviceProviders: [
                        { id: sp2.id, name: sp2.name },
                        { id: sp3.id, name: sp3.name },
                    ].sort(
                        (
                            a: {
                                id: string;
                                name: string;
                            },
                            b: {
                                id: string;
                                name: string;
                            },
                        ) => a.id.localeCompare(b.id),
                    ),
                }),
            );
            expect(pagedResponse.items).toContainEqual(expect.objectContaining({ serviceProviders: [] }));
        });

        it('should not return technische rollen', async () => {
            const orgaIds: string[] = (
                await Promise.all([
                    rolleRepo.save(DoFactory.createRolle(false, { istTechnisch: true })),
                    rolleRepo.save(DoFactory.createRolle(false, { istTechnisch: false })),
                    rolleRepo.save(DoFactory.createRolle(false, { istTechnisch: false })),
                ])
            ).map((r: Rolle<true> | DomainError) => {
                if (r instanceof DomainError) throw Error();
                return r.administeredBySchulstrukturknoten;
            });

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds });

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const pagedResponse: PagedResponse<RolleWithServiceProvidersResponse> =
                response.body as PagedResponse<RolleWithServiceProvidersResponse>;
            expect(pagedResponse.items).toHaveLength(2);
        });
    });

    describe('/GET rolle by id', () => {
        it('should return rolle', async () => {
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
            if (rolle instanceof DomainError) throw Error();

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [rolle.administeredBySchulstrukturknoten],
            });

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/rolle/${rolle.id}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
        });

        it('should return rolle with serviceproviders', async () => {
            const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                DoFactory.createServiceProvider(false),
            );
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
            );
            if (rolle instanceof DomainError) throw Error();

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [rolle.administeredBySchulstrukturknoten],
            });

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/rolle/${rolle.id}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const responseBody: RolleWithServiceProvidersResponse = response.body as RolleWithServiceProvidersResponse;

            expect(responseBody?.serviceProviders).toContainEqual(
                expect.objectContaining({ id: serviceProvider.id, name: serviceProvider.name }),
            );
        });

        it('should return 404 when rolle could not be found', async () => {
            await rolleRepo.save(DoFactory.createRolle(false));
            const response: Response = await request(app.getHttpServer() as App)
                .get(`/rolle/${faker.string.uuid()}`)
                .send();

            expect(response.status).toBe(404);
            expect(response.body).toBeInstanceOf(Object);
        });

        it('should return 404 when rolle is technical', async () => {
            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, { istTechnisch: true }),
            );
            if (rolle instanceof DomainError) throw Error();

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [rolle.administeredBySchulstrukturknoten],
            });

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/rolle/${rolle.id}`)
                .send();

            expect(response.status).toBe(404);
            expect(response.body).toBeInstanceOf(Object);
        });
    });

    describe('/PATCH rolle, add systemrecht', () => {
        describe('when rolle exists and systemrecht is matching enum', () => {
            it('should return 200', async () => {
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();

                const params: AddSystemrechtBodyParams = {
                    systemRecht: RollenSystemRecht.ROLLEN_VERWALTEN,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .patch(`/rolle/${rolle.id}`)
                    .send(params);

                expect(response.status).toBe(200);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 500', async () => {
                await rolleRepo.save(DoFactory.createRolle(false));
                const validButNonExistingUUID: string = faker.string.uuid();
                const params: AddSystemrechtBodyParams = {
                    systemRecht: RollenSystemRecht.ROLLEN_VERWALTEN,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .patch(`/rolle/${validButNonExistingUUID}`)
                    .send(params);

                expect(response.status).toBe(500);
            });
        });
    });

    describe('/GET rolleId/serviceProviders', () => {
        describe('when rolle exists', () => {
            it('should return 200 and a list of serviceProviders', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
                if (rolle instanceof DomainError) throw Error();

                const response: Response = await request(app.getHttpServer() as App)
                    .get(`/rolle/${rolle.id}/serviceProviders`)
                    .send();

                expect(response.status).toBe(200);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 404', async () => {
                const validButNonExistingUUID: string = faker.string.uuid();
                const response: Response = await request(app.getHttpServer() as App)
                    .get(`/rolle/${validButNonExistingUUID}/serviceProviders`)
                    .send();

                expect(response.status).toBe(404);
            });
        });
    });

    describe('/PUT rolleId/serviceProviders', () => {
        describe('when rolle and serviceProvider exist', () => {
            it('should return 201 and add serviceProvider', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();

                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [serviceProvider.id],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(201);
            });
        });

        describe('when rolle and serviceProvider exist, but serviceProvider is already attached', () => {
            it('should return 201', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
                if (rolle instanceof DomainError) throw Error();

                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [serviceProvider.id],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(201);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 404', async () => {
                const validButNonExistingUUID: string = faker.string.uuid();
                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [faker.string.uuid()],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/rolle/${validButNonExistingUUID}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(404);
            });
        });

        describe('when serviceProvider does not exist', () => {
            it('should return 404', async () => {
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();

                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [faker.string.uuid()],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(404);
            });
        });
    });

    describe('/DELETE rolleId/serviceProviders', () => {
        describe('when rolle and serviceProvider exist', () => {
            it('should return 200 and delete serviceProvider', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
                if (rolle instanceof DomainError) throw Error();

                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [serviceProvider.id],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(200);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 404', async () => {
                const validButNonExistingUUID: string = faker.string.uuid();
                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [faker.string.uuid()],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${validButNonExistingUUID}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(404);
            });
        });

        describe('when serviceProvider does not exist', () => {
            it('should return 500', async () => {
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) throw Error();
                const nonExistingServiceProviderId: string = faker.string.uuid();

                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [nonExistingServiceProviderId],
                    version: 1,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(404);
            });
        });
    });

    describe('/PUT rolle', () => {
        it('should return updated rolle', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);
            await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );
            if (rolle instanceof DomainError) throw Error();

            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [organisation.id],
            });

            const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                DoFactory.createServiceProvider(false),
            );

            const params: UpdateRolleBodyParams = {
                name: faker.person.jobTitle(),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                serviceProviderIds: [serviceProvider.id],
                version: 1,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .put(`/rolle/${rolle.id}`)
                .send(params);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                id: rolle.id,
                name: params.name,
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: rolle.rollenart,
                merkmale: params.merkmale,
                systemrechte: params.systemrechte,
            });
        });

        it('should fail if the rolle does not exist', async () => {
            const params: UpdateRolleBodyParams = {
                name: faker.person.jobTitle(),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                serviceProviderIds: [],
                version: 1,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .put(`/rolle/${faker.string.uuid()}`)
                .send(params);

            expect(response.status).toBe(404);
        });

        it('should return error with status-code 404 if user does NOT have permissions', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);
            await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );
            if (rolle instanceof DomainError) throw Error();

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({ all: false, orgaIds: [] });
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const params: UpdateRolleBodyParams = {
                name: faker.person.jobTitle(),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                serviceProviderIds: [],
                version: 1,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .put(`/rolle/${rolle.id}`)
                .send(params);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                code: 404,
                subcode: '01',
                titel: 'Angefragte Entität existiert nicht',
                beschreibung: 'Die angeforderte Entität existiert nicht',
            });
        });

        it('should return error with status-code 404 if rolle is technical', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);
            await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                    istTechnisch: true,
                }),
            );
            if (rolle instanceof DomainError) throw Error();

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                all: false,
                orgaIds: [organisation.id],
            });
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const params: UpdateRolleBodyParams = {
                name: faker.person.jobTitle(),
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                serviceProviderIds: [],
                version: 1,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .put(`/rolle/${rolle.id}`)
                .send(params);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                code: 404,
                subcode: '01',
                titel: 'Angefragte Entität existiert nicht',
                beschreibung: 'Die angeforderte Entität existiert nicht',
            });
        });

        describe('Update Merkmale', () => {
            it('should return 400 if rolle is already assigned', async () => {
                const personData: Person<false> | DomainError = await personFactory.createNew({
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    username: faker.internet.userName(),
                    password: generatePassword(),
                });
                if (personData instanceof DomainError) {
                    throw personData;
                }
                const person: Person<true> | DomainError = await personRepo.save(personData);
                if (person instanceof DomainError) {
                    throw person;
                }

                const organisation: OrganisationEntity = new OrganisationEntity();
                organisation.typ = OrganisationsTyp.SCHULE;
                await em.persistAndFlush(organisation);
                await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        istTechnisch: false,
                    }),
                );
                if (rolle instanceof DomainError) throw Error();

                await dBiamPersonenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: person.id,
                        rolleId: rolle.id,
                        organisationId: organisation.id,
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: [organisation.id],
                });
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const params: UpdateRolleBodyParams = {
                    name: faker.person.jobTitle(),
                    merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                    systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                    serviceProviderIds: [],
                    version: 1,
                };

                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/rolle/${rolle.id}`)
                    .send(params);

                expect(response.status).toBe(400);
                expect(response.body).toEqual({
                    code: 400,
                    i18nKey: 'UPDATE_MERKMALE_ERROR',
                });
            });
        });

        it('should return error if new name has trailing space', async () => {
            const organisation: OrganisationEntity = new OrganisationEntity();
            await em.persistAndFlush(organisation);

            await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

            const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );
            if (rolle instanceof DomainError) throw Error();

            const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                DoFactory.createServiceProvider(false),
            );

            const params: UpdateRolleBodyParams = {
                name: ' newName ',
                merkmale: [faker.helpers.enumValue(RollenMerkmal)],
                systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
                serviceProviderIds: [serviceProvider.id],
                version: 1,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .put(`/rolle/${rolle.id}`)
                .send(params);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 400,
                i18nKey: 'ROLLENNAME_ENTHAELT_LEERZEICHEN',
            });
        });
    });

    describe('/DELETE rolleId', () => {
        describe('should return error', () => {
            it('if rolle does NOT exist', async () => {
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${faker.string.uuid()}`)
                    .send();

                expect(response.status).toBe(404);
            });

            it('if rolle is already assigned to a Personenkontext', async () => {
                const personData: Person<false> | DomainError = await personFactory.createNew({
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    username: faker.internet.userName(),
                    password: generatePassword(),
                });
                if (personData instanceof DomainError) {
                    throw personData;
                }
                const person: Person<true> | DomainError = await personRepo.save(personData);
                if (person instanceof DomainError) {
                    throw person;
                }
                const organisation: OrganisationEntity = new OrganisationEntity();
                organisation.typ = OrganisationsTyp.SCHULE;
                await em.persistAndFlush(organisation);
                await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                    }),
                );
                if (rolle instanceof DomainError) throw Error();

                await dBiamPersonenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: person.id,
                        rolleId: rolle.id,
                        organisationId: organisation.id,
                    }),
                );
                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: [organisation.id],
                });
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}`)
                    .send();

                expect(response.status).toBe(400);
                expect(response.body).toEqual({
                    code: 400,
                    i18nKey: 'ROLLE_HAT_PERSONENKONTEXTE_ERROR',
                });
            });

            it('if user does NOT have permissions', async () => {
                const organisation: OrganisationEntity = new OrganisationEntity();
                await em.persistAndFlush(organisation);
                await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                    }),
                );
                if (rolle instanceof DomainError) throw Error();

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: [],
                });
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}`)
                    .send();

                expect(response.status).toBe(404);
                expect(response.body).toEqual({
                    code: 404,
                    subcode: '01',
                    titel: 'Angefragte Entität existiert nicht',
                    beschreibung: 'Die angeforderte Entität existiert nicht',
                });
            });

            it('if rolle is technical', async () => {
                const organisation: OrganisationEntity = new OrganisationEntity();
                await em.persistAndFlush(organisation);
                await em.findOneOrFail(OrganisationEntity, { id: organisation.id });

                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        istTechnisch: true,
                    }),
                );
                if (rolle instanceof DomainError) throw Error();

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: [organisation.id],
                });
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}`)
                    .send();

                expect(response.status).toBe(404);
                expect(response.body).toEqual({
                    code: 404,
                    subcode: '01',
                    titel: 'Angefragte Entität existiert nicht',
                    beschreibung: 'Die angeforderte Entität existiert nicht',
                });
            });
        });

        describe('should succeed', () => {
            it('if all conditions are passed', async () => {
                const organisation: OrganisationEntity = new OrganisationEntity();
                await em.persistAndFlush(organisation);
                await em.findOneOrFail(OrganisationEntity, { id: organisation.id });
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );

                const rolle: Rolle<true> | DomainError = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        serviceProviderIds: [serviceProvider.id],
                        istTechnisch: false,
                    }),
                );
                if (rolle instanceof DomainError) throw Error();

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: [organisation.id],
                });
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}`)
                    .send();

                expect(response.status).toBe(204);
            });
        });
    });
});
