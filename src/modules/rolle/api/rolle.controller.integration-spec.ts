import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
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
import { RolleFactory } from '../domain/rolle.factory.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { AddSystemrechtBodyParams } from './add-systemrecht.body.params.js';
import { Rolle } from '../domain/rolle.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { RolleServiceProviderQueryParams } from './rolle-service-provider.query.params.js';
import { RolleWithServiceProvidersResponse } from './rolle-with-serviceprovider.response.js';

describe('Rolle API', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let rolleRepo: RolleRepo;
    let serviceProviderRepo: ServiceProviderRepo;

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
                RolleFactory,
                ServiceProviderRepo,
            ],
        }).compile();

        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        rolleRepo = module.get(RolleRepo);
        serviceProviderRepo = module.get(ServiceProviderRepo);
        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

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
    });

    describe('/GET rollen', () => {
        it('should return all rollen', async () => {
            await Promise.all([
                rolleRepo.save(DoFactory.createRolle(false)),
                rolleRepo.save(DoFactory.createRolle(false)),
                rolleRepo.save(DoFactory.createRolle(false)),
            ]);

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(3);
        });

        it('should return rollen with the given queried name', async () => {
            const testRolle: { name: string } = await rolleRepo.save(DoFactory.createRolle(false));

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .query({ searchStr: testRolle.name })
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(1);
            expect(response.body).toContainEqual(expect.objectContaining({ name: testRolle.name }));
        });

        it('should return rollen with serviceproviders', async () => {
            const [sp1, sp2, sp3]: [ServiceProvider<true>, ServiceProvider<true>, ServiceProvider<true>] =
                await Promise.all([
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                    serviceProviderRepo.save(DoFactory.createServiceProvider(false)),
                ]);

            await Promise.all([
                rolleRepo.save(DoFactory.createRolle(false, { serviceProviderIds: [sp1.id] })),
                rolleRepo.save(DoFactory.createRolle(false, { serviceProviderIds: [sp2.id, sp3.id] })),
                rolleRepo.save(DoFactory.createRolle(false)),
            ]);

            const response: Response = await request(app.getHttpServer() as App)
                .get('/rolle')
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(3);

            expect(response.body).toContainEqual(
                expect.objectContaining({ serviceProviders: [{ id: sp1.id, name: sp1.name }] }),
            );
            expect(response.body).toContainEqual(
                expect.objectContaining({
                    serviceProviders: [
                        { id: sp2.id, name: sp2.name },
                        { id: sp3.id, name: sp3.name },
                    ],
                }),
            );
            expect(response.body).toContainEqual(expect.objectContaining({ serviceProviders: [] }));
        });
    });

    describe('/GET rolle by id', () => {
        it('should return rolle', async () => {
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
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
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
            );
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
    });

    describe('/PATCH rolle, add systemrecht', () => {
        describe('when rolle exists and systemrecht is matching enum', () => {
            it('should return 200', async () => {
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
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
            it('should return 200', async () => {
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
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
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

    describe('/POST rolleId/serviceProviders', () => {
        describe('when rolle and serviceProvider exist', () => {
            it('should return 201 and add serviceProvider', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const params: RolleServiceProviderQueryParams = {
                    serviceProviderId: serviceProvider.id,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .post(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(201);
            });
        });

        describe('when rolle and serviceProvider exist, but serviceProvider is already attached', () => {
            it('should return 400', async () => {
                const serviceProvider: ServiceProvider<true> = await serviceProviderRepo.save(
                    DoFactory.createServiceProvider(false),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
                const params: RolleServiceProviderQueryParams = {
                    serviceProviderId: serviceProvider.id,
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .post(`/rolle/${rolle.id}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(400);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 404', async () => {
                const validButNonExistingUUID: string = faker.string.uuid();
                const params: RolleServiceProviderQueryParams = {
                    serviceProviderId: faker.string.uuid(),
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .post(`/rolle/${validButNonExistingUUID}/serviceProviders`)
                    .send(params);

                expect(response.status).toBe(404);
            });
        });

        describe('when serviceProvider does not exist', () => {
            it('should return 404', async () => {
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const params: RolleServiceProviderQueryParams = {
                    serviceProviderId: faker.string.uuid(),
                };
                const response: Response = await request(app.getHttpServer() as App)
                    .post(`/rolle/${rolle.id}/serviceProviders`)
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
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, { serviceProviderIds: [serviceProvider.id] }),
                );
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}/serviceProviders?serviceProviderId=${serviceProvider.id}`)
                    .send();

                expect(response.status).toBe(200);
            });
        });

        describe('when rolle does not exist', () => {
            it('should return 404', async () => {
                const validButNonExistingUUID: string = faker.string.uuid();
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(
                        `/rolle/${validButNonExistingUUID}/serviceProviders?serviceProviderId=${faker.string.uuid()}`,
                    )
                    .send();

                expect(response.status).toBe(404);
            });
        });

        describe('when serviceProvider does not exist', () => {
            it('should return 500', async () => {
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const response: Response = await request(app.getHttpServer() as App)
                    .delete(`/rolle/${rolle.id}/serviceProviders?serviceProviderId=${faker.string.uuid()}`)
                    .send();

                expect(response.status).toBe(404);
            });
        });
    });
});
