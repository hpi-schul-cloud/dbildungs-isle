import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { MikroORM } from '@mikro-orm/core';
import { CallHandler, ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { Observable } from 'rxjs';
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
import { PersonPermissionsRepo } from '../../authentication/domain/person-permission.repo.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { PassportUser } from '../../authentication/types/user.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { DBiamPersonenkontextRepoInternal } from '../persistence/internal-dbiam-personenkontext.repo.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { PersonenKontextApiModule } from '../personenkontext-api.module.js';
import { KeycloakConfigModule } from '../../keycloak-administration/keycloak-config.module.js';
import { KeycloakAdministrationModule } from '../../keycloak-administration/keycloak-administration.module.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { UsernameGeneratorService } from '../../person/domain/username-generator.service.js';
import { PersonenkontextMigrationRuntype } from '../domain/personenkontext.enums.js';
import { generatePassword } from '../../../shared/util/password-generator.js';

describe('dbiam Personenkontext API', () => {
    let app: INestApplication;
    let orm: MikroORM;

    let personenkontextRepoInternal: DBiamPersonenkontextRepoInternal;
    let personRepo: PersonRepository;
    let organisationRepo: OrganisationRepository;
    let rolleRepo: RolleRepo;
    let personpermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;
    let personFactory: PersonFactory;

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
                PersonFactory,
                UsernameGeneratorService,
            ],
        })
            .overrideModule(KeycloakConfigModule)
            .useModule(KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true }))
            .compile();

        orm = module.get(MikroORM);
        personenkontextRepoInternal = module.get(DBiamPersonenkontextRepoInternal);
        personRepo = module.get(PersonRepository);
        organisationRepo = module.get(OrganisationRepository);
        rolleRepo = module.get(RolleRepo);
        personpermissionsRepoMock = module.get(PersonPermissionsRepo);
        personFactory = module.get(PersonFactory);

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

    describe('/GET personenkontexte for person', () => {
        it('should return personenkontexte for the person', async () => {
            const rolleA: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const rolleB: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const rolleC: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

            const personA: Person<true> = await createPerson();
            if (personA instanceof DomainError) {
                throw personA;
            }
            const personB: Person<true> = await createPerson();
            if (personB instanceof DomainError) {
                throw personB;
            }
            await Promise.all([
                personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: personA.id,
                        rolleId: rolleA.id,
                    }),
                ),
                personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: personA.id,
                        rolleId: rolleB.id,
                    }),
                ),
                personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: personB.id,
                        rolleId: rolleC.id,
                    }),
                ),
            ]);

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissions.canModifyPerson.mockResolvedValueOnce(true);
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenkontext/${personA.id}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(2);
        });

        it('should return empty list, if user has systemrechte at ROOT organisation', async () => {
            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
            personpermissions.canModifyPerson.mockResolvedValueOnce(true);

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenkontext/${faker.string.uuid()}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(0);
        });

        it('should return error when no results found and user is not admin', async () => {
            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
            personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(false);
            personpermissions.canModifyPerson.mockResolvedValueOnce(false);

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenkontext/${faker.string.uuid()}`)
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

    describe('/POST create personenkontext (Migration)', () => {
        describe('MigrationRunType: STANDARD', () => {
            it('should create personenkontext with personId', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        merkmale: [],
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(201);
            });

            it('should create personenkontext with username', async () => {
                const person: Person<true> = await createPerson();
                person.referrer = 'testusername';
                await personRepo.save(person);

                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        merkmale: [],
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        username: person.referrer,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(201);
            });

            it('should return error if neither personId or username passed', async () => {
                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        organisationId: faker.string.uuid(),
                        rolleId: faker.string.uuid(),
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if Not Migration User', async () => {
                const person: Person<true> = await createPerson();
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
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(false);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        username: undefined,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(404);
            });

            it('should return error if Kontext Already Exists', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                    }),
                );

                await personenkontextRepoInternal.save(
                    DoFactory.createPersonenkontext(false, {
                        personId: person.id,
                        rolleId: rolle.id,
                        organisationId: organisation.id,
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if Rolle Does not exist', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: faker.string.uuid(),
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if Organisation Does not exist', async () => {
                const person: Person<true> = await createPerson();
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
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: faker.string.uuid(),
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if Person Does not exist', async () => {
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
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: faker.string.uuid(),
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if No Email is Provided but Rollenart is LEHR', async () => {
                const person: Person<true> = await createPerson();
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
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });

            it('should return error if Email is Provided but Rollenart is Not LEHR', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LERN,
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.STANDARD,
                    });

                expect(response.status).toBe(500);
            });
        });

        describe('MigrationRunType: ITSLEARNING', () => {
            it('should create personenkontext with personId', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        merkmale: [],
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        migrationRunType: PersonenkontextMigrationRuntype.ITSLEARNING,
                    });

                expect(response.status).toBe(201);
            });

            it('should return error if mail is provided', async () => {
                const person: Person<true> = await createPerson();
                const organisation: Organisation<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false, { typ: OrganisationsTyp.SCHULE }),
                );
                const rolle: Rolle<true> = await rolleRepo.save(
                    DoFactory.createRolle(false, {
                        administeredBySchulstrukturknoten: organisation.id,
                        rollenart: RollenArt.LEHR,
                        merkmale: [],
                    }),
                );

                const personpermissions: DeepMocked<PersonPermissions> = createMock();
                personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);
                personpermissions.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                        email: 'test@schule-sh.de',
                        migrationRunType: PersonenkontextMigrationRuntype.ITSLEARNING,
                    });

                expect(response.status).toBe(500);
            });
        });
    });
});
