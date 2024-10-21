import { faker } from '@faker-js/faker';
import * as fs from 'fs';
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
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PersonPermissionsRepo } from '../../authentication/domain/person-permission.repo.js';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { PassportUser } from '../../authentication/types/user.js';

import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';

import { KeycloakUserService } from '../../keycloak-administration/domain/keycloak-user.service.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { KeycloakConfigModule } from '../../keycloak-administration/keycloak-config.module.js';
import { ImportApiModule } from '../import-api.module.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import path from 'path';
import { ImportDataRepository } from '../persistence/import-data.repository.js';
import { ImportvorgangByIdBodyParams } from './importvorgang-by-id.body.params.js';
import { ImportDataItem } from '../domain/import-data-item.js';

describe('Rolle API', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let rolleRepo: RolleRepo;
    let importDataRepository: ImportDataRepository;
    let personpermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;
    let personPermissionsMock: DeepMocked<PersonPermissions>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ImportApiModule,
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
        importDataRepository = module.get(ImportDataRepository);
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

    describe('/POST import', () => {
        it('should return 201 OK with ImportUploadResponse', async () => {
            const filePath: string = path.resolve('./', `test/imports/valid_test_import_SuS.csv`);

            const fileExists: boolean = fs.existsSync(filePath);
            if (!fileExists) throw new Error('file does not exist');

            const schule: OrganisationEntity = new OrganisationEntity();
            schule.typ = OrganisationsTyp.SCHULE;
            await em.persistAndFlush(schule);
            await em.findOneOrFail(OrganisationEntity, { id: schule.id });

            const sus: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    rollenart: RollenArt.LERN,
                    administeredBySchulstrukturknoten: schule.id,
                }),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/upload')
                .set('content-type', 'multipart/form-data')
                .field('organisationId', schule.id)
                .field('rolleId', sus.id)
                .attach('file', filePath);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                importvorgangId: expect.any(String) as unknown as string,
                isValid: true,
            });
        });

        it('should return 404 if the organisation is not found', async () => {
            const filePath: string = path.resolve('./', `test/imports/valid_test_import_SuS.csv`);

            const fileExists: boolean = fs.existsSync(filePath);
            if (!fileExists) throw new Error('file does not exist');

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/upload')
                .set('content-type', 'multipart/form-data')
                .field('organisationId', faker.string.uuid())
                .field('rolleId', faker.string.uuid())
                .attach('file', filePath);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                code: 404,
                subcode: '01',
                titel: 'Angefragte Entität existiert nicht',
                beschreibung: 'Die angeforderte Entität existiert nicht',
            });
        });

        it('should return 400 with CSV_PARSING_ERROR if the csv file can be parsed but has data items errors', async () => {
            const filePath: string = path.resolve('./', `test/imports/invalid_test_import_SuS.csv`);

            const fileExists: boolean = fs.existsSync(filePath);
            if (!fileExists) throw new Error('file does not exist');

            const schule: OrganisationEntity = new OrganisationEntity();
            schule.typ = OrganisationsTyp.SCHULE;
            await em.persistAndFlush(schule);
            await em.findOneOrFail(OrganisationEntity, { id: schule.id });

            const sus: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    rollenart: RollenArt.LERN,
                    administeredBySchulstrukturknoten: schule.id,
                }),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/upload')
                .set('content-type', 'multipart/form-data')
                .field('organisationId', schule.id)
                .field('rolleId', sus.id)
                .attach('file', filePath);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 400,
                i18nKey: 'CSV_PARSING_ERROR',
            });
        });

        it('should return 400 with CSV_PARSING_ERROR if the csv file is empty', async () => {
            const filePath: string = path.resolve('./', `test/imports/empty_test_import_SuS.csv`);

            const fileExists: boolean = fs.existsSync(filePath);
            if (!fileExists) throw new Error('file does not exist');

            const schule: OrganisationEntity = new OrganisationEntity();
            schule.typ = OrganisationsTyp.SCHULE;
            await em.persistAndFlush(schule);
            await em.findOneOrFail(OrganisationEntity, { id: schule.id });

            const sus: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    rollenart: RollenArt.LERN,
                    administeredBySchulstrukturknoten: schule.id,
                }),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/upload')
                .set('content-type', 'multipart/form-data')
                .field('organisationId', schule.id)
                .field('rolleId', sus.id)
                .attach('file', filePath);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 400,
                i18nKey: 'CSV_FILE_EMPTY_ERROR',
            });
        });

        it('should return 400 if the file mime type is not csv', async () => {
            const filePath: string = path.resolve('./', `test/imports/invalid_filetype_test_import.txt`);

            const fileExists: boolean = fs.existsSync(filePath);
            if (!fileExists) throw new Error('file does not exist');

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/upload')
                .set('content-type', 'multipart/form-data')
                .field('organisationId', faker.string.uuid())
                .field('rolleId', faker.string.uuid())
                .attach('file', filePath);

            expect(response.status).toBe(400);
        });
    });

    describe('/POST execute', () => {
        it('should return 200 OK with the file', async () => {
            const schule: OrganisationEntity = new OrganisationEntity();
            schule.typ = OrganisationsTyp.SCHULE;
            schule.name = 'Import Schule';
            await em.persistAndFlush(schule);
            await em.findOneOrFail(OrganisationEntity, { id: schule.id });

            const klasse: OrganisationEntity = new OrganisationEntity();
            klasse.typ = OrganisationsTyp.KLASSE;
            klasse.name = '1A';
            klasse.administriertVon = schule.id;
            klasse.zugehoerigZu = schule.id;
            await em.persistAndFlush(klasse);
            await em.findOneOrFail(OrganisationEntity, { id: klasse.id });

            const sus: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    rollenart: RollenArt.LERN,
                    administeredBySchulstrukturknoten: schule.id,
                    merkmale: [],
                }),
            );

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = await importDataRepository.save(
                DoFactory.createImportDataItem(false, {
                    importvorgangId: importvorgangId,
                    klasse: klasse.name,
                    personalnummer: undefined,
                }),
            );

            const params: ImportvorgangByIdBodyParams = {
                importvorgangId: importvorgangId,
                organisationId: schule.id,
                rolleId: sus.id,
            };

            const response: Response = await request(app.getHttpServer() as App)
                .post('/import/execute')
                .send(params);

            expect(response.status).toBe(200);
            expect(response.type).toBe('text/plain');

            const resultString: string = response.text;
            expect(resultString).toContain(schule.name);
            expect(resultString).toContain(sus.name);
            expect(resultString).toContain(importDataItem.vorname);
            expect(resultString).toContain(importDataItem.nachname);
            expect(resultString).toContain(klasse.name);
        });

        it('should return 404 if the import transaction is not found', async () => {
            const params: ImportvorgangByIdBodyParams = {
                importvorgangId: faker.string.uuid(),
                organisationId: faker.string.uuid(),
                rolleId: faker.string.uuid(),
            };

            const executeResponse: Response = await request(app.getHttpServer() as App)
                .post('/import/execute')
                .send(params);

            expect(executeResponse.status).toBe(404);
        });
    });
});
