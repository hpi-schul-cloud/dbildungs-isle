import { faker } from '@faker-js/faker';
import { MikroORM } from '@mikro-orm/core';
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
import { GlobalValidationPipe } from '../../../shared/validation/index.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonenKontextApiModule } from '../personenkontext-api.module.js';
import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { RolleFactory } from '../../rolle/domain/rolle.factory.js';
import { PersonPermissionsRepo } from '../../authentication/domain/person-permission.repo.js';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Observable } from 'rxjs';
import { PassportUser } from '../../authentication/types/user.js';
import { Request } from 'express';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';

import { DBiamPersonenkontextRepoInternal } from '../persistence/internal-dbiam-personenkontext.repo.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { DbiamUpdatePersonenkontexteBodyParams } from './param/dbiam-update-personenkontexte.body.params.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { KeycloakAdministrationModule } from '../../keycloak-administration/keycloak-administration.module.js';
import { KeycloakConfigModule } from '../../keycloak-administration/keycloak-config.module.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { Person } from '../../person/domain/person.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { PersonenkontextCreationService } from '../domain/personenkontext-creation.service.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { PersonenkontexteUpdateError } from '../domain/error/personenkontexte-update.error.js';
import { generatePassword } from '../../../shared/util/password-generator.js';

function createRolle(this: void, rolleFactory: RolleFactory, params: Partial<Rolle<boolean>> = {}): Rolle<false> {
    const rolle: Rolle<false> | DomainError = rolleFactory.createNew(
        faker.string.alpha(),
        faker.string.uuid(),
        faker.helpers.enumValue(RollenArt),
        [faker.helpers.enumValue(RollenMerkmal)],
        [faker.helpers.enumValue(RollenSystemRecht)],
        [],
        [],
        false,
    );
    Object.assign(rolle, params);

    if (rolle instanceof DomainError) {
        throw rolle;
    }
    return rolle;
}

describe('DbiamPersonenkontextWorkflowController Integration Test', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let organisationRepo: OrganisationRepository;
    let rolleRepo: RolleRepo;
    let rolleFactory: RolleFactory;
    let personpermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;
    let personRepo: PersonRepository;
    let personenkontextRepoInternal: DBiamPersonenkontextRepoInternal;
    let personFactory: PersonFactory;
    let personenkontextService: PersonenkontextCreationService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MapperTestModule,
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                PersonenKontextApiModule,
                KeycloakAdministrationModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
                {
                    provide: PersonPermissionsRepo,
                    useValue: createMock<PersonPermissionsRepo>(),
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
            ],
        })
            .overrideModule(KeycloakConfigModule)
            .useModule(KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }))
            .compile();

        orm = module.get(MikroORM);
        organisationRepo = module.get(OrganisationRepository);
        rolleRepo = module.get(RolleRepo);
        rolleFactory = module.get(RolleFactory);
        personpermissionsRepoMock = module.get(PersonPermissionsRepo);
        personRepo = module.get(PersonRepository);
        personenkontextRepoInternal = module.get(DBiamPersonenkontextRepoInternal);
        personFactory = module.get(PersonFactory);
        personenkontextService = module.get(PersonenkontextCreationService);

        await DatabaseTestModule.setupDatabase(orm);
        app = module.createNestApplication();
        await app.init();
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
        await app.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    describe('/POST create person with personenkontexte', () => {
        it('should return created person and personenkontexte', async () => {
            const schule: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const klasse: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.KLASSE, administriertVon: schule.id }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: schule.id,
                    rollenart: RollenArt.LERN,
                    merkmale: [RollenMerkmal.KOPERS_PFLICHT],
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: schule.id,
                            rolleId: rolle.id,
                        },
                        {
                            organisationId: klasse.id,
                            rolleId: rolle.id,
                        },
                    ],
                });
            expect(response.status).toBe(201);
        });

        it('should return created person and personenkontext with personalnummer', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                    merkmale: [RollenMerkmal.KOPERS_PFLICHT],
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: organisation.id,
                            rolleId: rolle.id,
                        },
                    ],
                    personalnummer: '1234567',
                });
            expect(response.status).toBe(201);
        });

        it('should return error with status-code=404 if organisation does NOT exist', async () => {
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: faker.string.uuid(),
                    rollenart: RollenArt.LEHR,
                }),
            );
            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);
            permissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            permissions.canModifyPerson.mockResolvedValueOnce(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(permissions);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: faker.string.uuid(),
                            rolleId: rolle.id,
                        },
                    ],
                });

            expect(response.status).toBe(404);
        });

        it('should return error with status-code 400 if specification ROLLE_NUR_AN_PASSENDE_ORGANISATION is NOT satisfied', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.SYSADMIN,
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: organisation.id,
                            rolleId: rolle.id,
                        },
                    ],
                });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 400,
                i18nKey: 'ROLLE_NUR_AN_PASSENDE_ORGANISATION',
            });
        });

        it('should return error with status-code 404 if user does NOT have permissions', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(false);
            personpermissions.hasSystemrechteAtOrganisation.mockResolvedValueOnce(false);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: organisation.id,
                            rolleId: rolle.id,
                        },
                    ],
                });
            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                code: 404,
                subcode: '01',
                titel: 'Angefragte Entität existiert nicht',
                beschreibung: 'Die angeforderte Entität existiert nicht',
            });
        });
        it('should return error with status-code 400 if DuplicatePersonalnummerError is thrown', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            // Mock the service to throw DuplicatePersonalnummerError
            jest.spyOn(personenkontextService, 'createPersonWithPersonenkontexte').mockResolvedValueOnce(
                new DuplicatePersonalnummerError('Duplicate Kopers'),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    organisationId: organisation.id,
                    rolleId: rolle.id,
                    personalnummer: '1234567',
                });

            expect(response.status).toBe(400);
        });
        it('should return error with status-code 400 if PersonenkontexteUpdateError is thrown', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            // Mock the service to throw DuplicatePersonalnummerError
            jest.spyOn(personenkontextService, 'createPersonWithPersonenkontexte').mockResolvedValueOnce(
                new PersonenkontexteUpdateError('Error'),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: organisation.id,
                            rolleId: rolle.id,
                        },
                    ],
                    personalnummer: '1234567',
                });

            expect(response.status).toBe(400);
        });
        it('should return error with status-code 400 if PersonenkontexteUpdateError is thrown', async () => {
            const organisation: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                DoFactory.createRolle(false, {
                    administeredBySchulstrukturknoten: organisation.id,
                    rollenart: RollenArt.LEHR,
                }),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.hasSystemrechtAtOrganisation.mockResolvedValue(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            // Mock the service to throw DuplicatePersonalnummerError
            jest.spyOn(personenkontextService, 'createPersonWithPersonenkontexte').mockResolvedValueOnce(
                new PersonenkontexteUpdateError('Error'),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/personenkontext-workflow')
                .send({
                    familienname: faker.person.lastName(),
                    vorname: faker.person.firstName(),
                    createPersonenkontexte: [
                        {
                            organisationId: organisation.id,
                            rolleId: rolle.id,
                        },
                    ],
                    personalnummer: '1234567',
                });

            expect(response.status).toBe(400);
        });
    });

    describe('/PUT commit', () => {
        describe('when sending no PKs', () => {
            it('should delete and therefore return 200', async () => {
                const person: Person<true> = await createPerson();
                const orga: Organisation<true> = await organisationRepo.save(DoFactory.createOrganisation(false));
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, { systemrechte: [RollenSystemRecht.PERSONEN_VERWALTEN] }),
                );
                const savedPK: Personenkontext<true> = await personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: person.id,
                        rolleId: rolle.id,
                        organisationId: orga.id,
                        updatedAt: new Date(),
                    }),
                );
                const updatePKsRequest: DbiamUpdatePersonenkontexteBodyParams =
                    createMock<DbiamUpdatePersonenkontexteBodyParams>({
                        count: 1,
                        lastModified: savedPK.updatedAt,
                        personenkontexte: [],
                    });
                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.canModifyPerson.mockResolvedValueOnce(true);
                personpermissions.hasSystemrechtAtOrganisation.mockResolvedValueOnce(true);
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/personenkontext-workflow/${person.id}`)
                    .send(updatePKsRequest);

                expect(response.status).toBe(200);
            });
        });

        describe('when errors occur', () => {
            it('should return error because the count is not matching', async () => {
                const person: Person<true> = await createPerson();
                const rolle: Rolle<true> | DomainError = await rolleRepo.save(DoFactory.createRolle(false));
                if (rolle instanceof DomainError) {
                    throw rolle;
                }
                const savedPK: Personenkontext<true> = await personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: person.id,
                        rolleId: rolle.id,
                        updatedAt: new Date(),
                    }),
                );
                const updatePKsRequest: DbiamUpdatePersonenkontexteBodyParams =
                    createMock<DbiamUpdatePersonenkontexteBodyParams>({
                        count: 0,
                        lastModified: savedPK.updatedAt,
                        personenkontexte: [],
                    });

                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/personenkontext-workflow/${person.id}`)
                    .send(updatePKsRequest);

                expect(response.status).toBe(400);
            });
        });

        describe('for Person with a PK rolle with rollenart LERN', () => {
            it('should return error with status-code 400, if the new PK rolle is not rollenart LERN', async () => {
                const schueler: Person<true> = await createPerson();
                const schule: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const lernRolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, { rollenart: RollenArt.LERN, systemrechte: [] }),
                );
                const savedPK: Personenkontext<true> = await personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: schueler.id,
                        rolleId: lernRolle.id,
                        organisationId: schule.id,
                        updatedAt: new Date(),
                    }),
                );

                const lehrerRolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        rollenart: RollenArt.LEHR,
                        systemrechte: [RollenSystemRecht.KLASSEN_VERWALTEN],
                    }),
                );

                const updatePKsRequest: DbiamUpdatePersonenkontexteBodyParams =
                    createMock<DbiamUpdatePersonenkontexteBodyParams>({
                        count: 2,
                        lastModified: savedPK.updatedAt,
                        personenkontexte: [
                            {
                                personId: schueler.id,
                                rolleId: lernRolle.id,
                                organisationId: schule.id,
                            },
                            {
                                personId: schueler.id,
                                rolleId: lehrerRolle.id,
                                organisationId: schule.id,
                            },
                        ],
                    });
                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissions.canModifyPerson.mockResolvedValueOnce(true);
                personpermissions.hasSystemrechtAtOrganisation.mockResolvedValueOnce(true);
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

                const response: Response = await request(app.getHttpServer() as App)
                    .put(`/personenkontext-workflow/${schueler.id}`)
                    .send(updatePKsRequest);

                expect(response.status).toBe(400);
                expect(response.body).toEqual({
                    code: 400,
                    i18nKey: 'INVALID_PERSONENKONTEXT_FOR_PERSON_WITH_ROLLENART_LERN',
                });
            });
        });
    });

    describe('/GET schulstrukturknoten for personenkontext', () => {
        it('should return all schulstrukturknoten for a personenkontext based on PersonenkontextAnlage', async () => {
            const rolleName: string = faker.string.alpha({ length: 10 });
            const sskName: string = faker.company.name();
            const parentOrga: Organisation<true> = await organisationRepo.save(
                DoFactory.createOrganisation(false, { typ: OrganisationsTyp.LAND }),
            );
            const rolle: Rolle<true> = await rolleRepo.save(
                createRolle(rolleFactory, {
                    name: rolleName,
                    rollenart: RollenArt.LEHR,
                    administeredBySchulstrukturknoten: parentOrga.id,
                }),
            );
            const rolleId: string = rolle.id;
            await organisationRepo.save(
                DoFactory.createOrganisation(false, {
                    name: sskName,
                    administriertVon: parentOrga.id,
                    typ: OrganisationsTyp.SCHULE,
                }),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/personenkontext-workflow/schulstrukturknoten?rolleId=${rolleId}&sskName=${sskName}&limit=25`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
        });

        it('should return all schulstrukturknoten for a personenkontext based on PersonenkontextAnlage even when no sskName is provided', async () => {
            const rolleName: string = faker.string.alpha({ length: 10 });
            const sskName: string = faker.company.name();
            const rolle: Rolle<true> = await rolleRepo.save(createRolle(rolleFactory, { name: rolleName }));
            const rolleId: string = rolle.id;
            await organisationRepo.save(DoFactory.createOrganisation(false, { name: sskName }));

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/personenkontext-workflow/schulstrukturknoten?rolleId=${rolleId}&limit=25`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
        });

        it('should return empty list', async () => {
            const response: Response = await request(app.getHttpServer() as App)
                .get(
                    `/personenkontext-workflow/schulstrukturknoten?rolleId=${faker.string.uuid()}&sskName=${faker.string.alpha()}&limit=25`,
                )
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
        });

        it('should return empty list even when no sskName is provided', async () => {
            const response: Response = await request(app.getHttpServer() as App)
                .get(`/personenkontext-workflow/schulstrukturknoten?rolleId=${faker.string.uuid()}&limit=25`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
        });
    });
});
