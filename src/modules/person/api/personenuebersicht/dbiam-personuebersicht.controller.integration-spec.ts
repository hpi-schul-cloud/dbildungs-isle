import { MikroORM } from '@mikro-orm/core';
import { CallHandler, ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types.js';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
    MapperTestModule,
} from '../../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../../shared/validation/global-validation.pipe.js';
import { ServiceProviderRepo } from '../../../service-provider/repo/service-provider.repo.js';
import { PersonApiModule } from '../../person-api.module.js';
import { PersonRepository } from '../../persistence/person.repository.js';
import { UsernameGeneratorService } from '../../domain/username-generator.service.js';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Person, PersonCreationParams } from '../../domain/person.js';
import { faker } from '@faker-js/faker';
import { DomainError } from '../../../../shared/error/index.js';
import { KeycloakUserService } from '../../../keycloak-administration/index.js';
import { DBiamPersonenuebersichtResponse } from './dbiam-personenuebersicht.response.js';
import { RolleFactory } from '../../../rolle/domain/rolle.factory.js';
import { RollenArt } from '../../../rolle/domain/rolle.enums.js';
import { RolleRepo } from '../../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../../rolle/domain/rolle.js';
import { OrganisationRepo } from '../../../organisation/persistence/organisation.repo.js';
import { OrganisationDo } from '../../../organisation/domain/organisation.do.js';
import { Personenkontext } from '../../../personenkontext/domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from '../../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { DBiamPersonenzuordnungResponse } from './dbiam-personenzuordnung.response.js';
import { PagedResponse } from '../../../../shared/paging/index.js';
import { PersonPermissionsRepo } from '../../../authentication/domain/person-permission.repo.js';
import { PersonPermissions } from '../../../authentication/domain/person-permissions.js';
import { Request } from 'express';
import { PassportUser } from '../../../authentication/types/user.js';
import { Observable } from 'rxjs';
import { DBiamPersonenuebersichtController } from './dbiam-personenuebersicht.controller.js';
import { OrganisationID } from '../../../../shared/types/aggregate-ids.types.js';

describe('Personenuebersicht API', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let personRepository: PersonRepository;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;
    let rolleFactory: RolleFactory;
    let rolleRepo: RolleRepo;
    let organisationRepo: OrganisationRepo;
    let dBiamPersonenkontextRepo: DBiamPersonenkontextRepo;
    let personpermissionsRepoMock: DeepMocked<PersonPermissionsRepo>;

    let ROOT_ORGANISATION_ID: OrganisationID;

    beforeAll(async () => {
        const keycloakUserServiceMock: KeycloakUserService = createMock<KeycloakUserService>({
            create: jest.fn().mockResolvedValue({ ok: true, value: '' }),
            setPassword: jest.fn().mockResolvedValue({ ok: true, value: '' }),
            delete: jest.fn().mockResolvedValue({ ok: true }),
        });

        const module: TestingModule = await Test.createTestingModule({
            imports: [
                PersonApiModule,
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
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: PersonPermissionsRepo,
                    useValue: createMock<PersonPermissionsRepo>(),
                },
                ServiceProviderRepo,
                PersonRepository,
                RolleFactory,
                RolleRepo,
                OrganisationRepo,
                DBiamPersonenkontextRepo,
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
            .overrideProvider(KeycloakUserService)
            .useValue(keycloakUserServiceMock)
            .compile();

        orm = module.get<MikroORM>(MikroORM);
        personRepository = module.get<PersonRepository>(PersonRepository);
        usernameGeneratorService = module.get(UsernameGeneratorService);
        usernameGeneratorService.generateUsername = jest.fn().mockResolvedValue({ ok: true, value: 'mockUsername' });
        rolleFactory = module.get(RolleFactory);
        rolleRepo = module.get(RolleRepo);
        organisationRepo = module.get(OrganisationRepo);
        dBiamPersonenkontextRepo = module.get(DBiamPersonenkontextRepo);
        personpermissionsRepoMock = module.get(PersonPermissionsRepo);

        ROOT_ORGANISATION_ID = module.get(DBiamPersonenuebersichtController).ROOT_ORGANISATION_ID;

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

    describe('/GET personenuebersicht', () => {
        describe('when successfull', () => {
            describe('when no kontexts exists', () => {
                it('should return personuebersicht with zuordnungen as []', async () => {
                    const creationParams: PersonCreationParams = {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    };

                    const person: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        creationParams,
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    const savedPerson: Person<true> | DomainError = await personRepository.create(person);
                    expect(savedPerson).not.toBeInstanceOf(DomainError);
                    if (savedPerson instanceof DomainError) {
                        return;
                    }

                    const response: Response = await request(app.getHttpServer() as App)
                        .get(`/dbiam/personenuebersicht/${savedPerson.id}`)
                        .send();

                    expect(response.status).toBe(200);
                    expect(response.body).toBeInstanceOf(Object);
                    const responseBody: DBiamPersonenuebersichtResponse =
                        response.body as DBiamPersonenuebersichtResponse;

                    expect(responseBody?.personId).toEqual(savedPerson.id);
                    expect(responseBody?.vorname).toEqual(savedPerson.vorname);
                    expect(responseBody?.nachname).toEqual(savedPerson.familienname);
                    expect(responseBody?.benutzername).toEqual(savedPerson.referrer);
                    expect(responseBody?.zuordnungen).toEqual([]);
                });
            });

            describe('when kontexts exists', () => {
                it('should return personuebersicht with zuordnungen', async () => {
                    const creationParams: PersonCreationParams = {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    };

                    const person: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        creationParams,
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    const savedPerson: Person<true> | DomainError = await personRepository.create(person);
                    expect(savedPerson).not.toBeInstanceOf(DomainError);
                    if (savedPerson instanceof DomainError) {
                        return;
                    }

                    const savedRolle1: Rolle<true> = await rolleRepo.save(
                        rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LEHR, [], [], []),
                    );
                    const savedRolle2: Rolle<true> = await rolleRepo.save(
                        rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LERN, [], [], []),
                    );

                    const savedOrganisation1: OrganisationDo<true> = await organisationRepo.save(
                        DoFactory.createOrganisation(true),
                    );
                    const savedOrganisation2: OrganisationDo<true> = await organisationRepo.save(
                        DoFactory.createOrganisation(true),
                    );

                    const personenkontext1: Personenkontext<true> = await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation1.id, savedRolle1.id),
                    );
                    const personenkontext2: Personenkontext<true> = await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation1.id, savedRolle2.id),
                    );
                    const personenkontext3: Personenkontext<true> = await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation2.id, savedRolle2.id),
                    );

                    const response: Response = await request(app.getHttpServer() as App)
                        .get(`/dbiam/personenuebersicht/${savedPerson.id}`)
                        .send();

                    expect(response.status).toBe(200);
                    expect(response.body).toBeInstanceOf(Object);
                    const responseBody: DBiamPersonenuebersichtResponse =
                        response.body as DBiamPersonenuebersichtResponse;
                    expect(responseBody?.personId).toEqual(savedPerson.id);
                    expect(responseBody?.vorname).toEqual(savedPerson.vorname);
                    expect(responseBody?.nachname).toEqual(savedPerson.familienname);
                    expect(responseBody?.benutzername).toEqual(savedPerson.referrer);
                    expect(responseBody?.zuordnungen.length).toEqual(3);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.rolleId === personenkontext1.rolleId,
                        ),
                    ).not.toEqual(-1);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.rolleId === personenkontext2.rolleId,
                        ),
                    ).not.toEqual(-1);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.rolleId === personenkontext3.rolleId,
                        ),
                    ).not.toEqual(-1);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.sskId === personenkontext1.organisationId,
                        ),
                    ).not.toEqual(-1);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.sskId === personenkontext2.organisationId,
                        ),
                    ).not.toEqual(-1);
                    expect(
                        responseBody.zuordnungen.findIndex(
                            (zuordnung: DBiamPersonenzuordnungResponse) =>
                                zuordnung.sskId === personenkontext3.organisationId,
                        ),
                    ).not.toEqual(-1);
                });
            });
        });
        describe('when not successfull', () => {
            describe('when person does not exist', () => {
                it('should return Error', async () => {
                    const unsavedPerson: Person<true> = Person.construct(
                        faker.string.uuid(),
                        faker.date.past(),
                        faker.date.recent(),
                        faker.person.lastName(),
                        faker.person.firstName(),
                        '1',
                        faker.lorem.word(),
                        faker.lorem.word(),
                        faker.string.uuid(),
                    );

                    const response: Response = await request(app.getHttpServer() as App)
                        .get(`/dbiam/personenuebersicht/${unsavedPerson.id}`)
                        .send();

                    expect(response.status).toBe(404);
                });
            });
            describe('when one or more rollen does not exist', () => {
                it('should return Error', async () => {
                    const creationParams: PersonCreationParams = {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    };

                    const person: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        creationParams,
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    const savedPerson: Person<true> | DomainError = await personRepository.create(person);
                    expect(savedPerson).not.toBeInstanceOf(DomainError);
                    if (savedPerson instanceof DomainError) {
                        return;
                    }

                    const unsavedRolle1: Rolle<true> = rolleFactory.construct(
                        faker.string.uuid(),
                        faker.date.recent(),
                        faker.date.recent(),
                        faker.string.alpha(5),
                        faker.string.uuid(),
                        RollenArt.LEHR,
                        [],
                        [],
                        [],
                    );

                    const savedRolle2: Rolle<true> = await rolleRepo.save(
                        rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LERN, [], [], []),
                    );

                    const savedOrganisation1: OrganisationDo<true> = await organisationRepo.save(
                        DoFactory.createOrganisation(true),
                    );
                    const savedOrganisation2: OrganisationDo<true> = await organisationRepo.save(
                        DoFactory.createOrganisation(true),
                    );

                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation1.id, unsavedRolle1.id),
                    );
                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation1.id, savedRolle2.id),
                    );
                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation2.id, savedRolle2.id),
                    );

                    const response: Response = await request(app.getHttpServer() as App)
                        .get(`/dbiam/personenuebersicht/${savedPerson.id}`)
                        .send();

                    expect(response.status).toBe(404);
                });
            });
            describe('when one or more organisations does not exist', () => {
                it('should return Error', async () => {
                    const creationParams: PersonCreationParams = {
                        familienname: faker.person.lastName(),
                        vorname: faker.person.firstName(),
                    };

                    const person: Person<false> | DomainError = await Person.createNew(
                        usernameGeneratorService,
                        creationParams,
                    );
                    expect(person).not.toBeInstanceOf(DomainError);
                    if (person instanceof DomainError) {
                        return;
                    }
                    const savedPerson: Person<true> | DomainError = await personRepository.create(person);
                    expect(savedPerson).not.toBeInstanceOf(DomainError);
                    if (savedPerson instanceof DomainError) {
                        return;
                    }

                    const savedRolle1: Rolle<true> = await rolleRepo.save(
                        rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LEHR, [], [], []),
                    );
                    const savedRolle2: Rolle<true> = await rolleRepo.save(
                        rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LERN, [], [], []),
                    );

                    const unsavedOrganisation1: OrganisationDo<true> = DoFactory.createOrganisation(true);
                    const savedOrganisation2: OrganisationDo<true> = await organisationRepo.save(
                        DoFactory.createOrganisation(true),
                    );

                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, unsavedOrganisation1.id, savedRolle1.id),
                    );
                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, unsavedOrganisation1.id, savedRolle2.id),
                    );
                    await dBiamPersonenkontextRepo.save(
                        Personenkontext.createNew(savedPerson.id, savedOrganisation2.id, savedRolle2.id),
                    );

                    const response: Response = await request(app.getHttpServer() as App)
                        .get(`/dbiam/personenuebersicht/${savedPerson.id}`)
                        .send();

                    expect(response.status).toBe(404);
                });
            });
        });
    });
    describe('/GET personenuebersichten', () => {
        it('should return personuebersichten with zuordnungen', async () => {
            const creationParams: PersonCreationParams = {
                familienname: faker.person.lastName(),
                vorname: faker.person.firstName(),
            };

            const person1: Person<false> | DomainError = await Person.createNew(
                usernameGeneratorService,
                creationParams,
            );
            expect(person1).not.toBeInstanceOf(DomainError);
            if (person1 instanceof DomainError) {
                return;
            }
            const savedPerson1: Person<true> | DomainError = await personRepository.create(person1);
            expect(savedPerson1).not.toBeInstanceOf(DomainError);
            if (savedPerson1 instanceof DomainError) {
                return;
            }

            const person2: Person<false> | DomainError = await Person.createNew(
                usernameGeneratorService,
                creationParams,
            );
            expect(person2).not.toBeInstanceOf(DomainError);
            if (person2 instanceof DomainError) {
                return;
            }
            const savedPerson2: Person<true> | DomainError = await personRepository.create(person2);
            expect(savedPerson2).not.toBeInstanceOf(DomainError);
            if (savedPerson2 instanceof DomainError) {
                return;
            }

            const savedRolle1: Rolle<true> = await rolleRepo.save(
                rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LEHR, [], [], []),
            );
            const savedRolle2: Rolle<true> = await rolleRepo.save(
                rolleFactory.createNew(faker.string.alpha(5), faker.string.uuid(), RollenArt.LERN, [], [], []),
            );

            const savedOrganisation1: OrganisationDo<true> = await organisationRepo.save(
                DoFactory.createOrganisation(true, { id: ROOT_ORGANISATION_ID }),
            );
            const savedOrganisation2: OrganisationDo<true> = await organisationRepo.save(
                DoFactory.createOrganisation(true),
            );

            await dBiamPersonenkontextRepo.save(
                Personenkontext.createNew(savedPerson1.id, savedOrganisation1.id, savedRolle1.id),
            );
            await dBiamPersonenkontextRepo.save(
                Personenkontext.createNew(savedPerson1.id, savedOrganisation1.id, savedRolle2.id),
            );
            await dBiamPersonenkontextRepo.save(
                Personenkontext.createNew(savedPerson1.id, savedOrganisation2.id, savedRolle2.id),
            );

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personpermissionsRepoMock.loadPersonPermissions.mockResolvedValue(personpermissions);

            personpermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                savedOrganisation1.id,
                savedOrganisation2.id,
            ]);

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenuebersicht`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Object);
            const responseBody: PagedResponse<DBiamPersonenuebersichtResponse> =
                response.body as PagedResponse<DBiamPersonenuebersichtResponse>;
            expect(responseBody.total).toEqual(2);
            expect(responseBody.items?.length).toEqual(2);
            const item1: DBiamPersonenuebersichtResponse | undefined = responseBody.items.at(0);

            expect(item1).toBeDefined();
            if (!(item1 instanceof DBiamPersonenuebersichtResponse)) {
                return;
            }

            expect(item1?.personId).toEqual(savedPerson1.id);
            expect(item1?.vorname).toEqual(savedPerson1.vorname);
            expect(item1?.nachname).toEqual(savedPerson1.familienname);
            expect(item1?.benutzername).toEqual(savedPerson1.referrer);
            expect(item1?.zuordnungen.length).toEqual(3);
        });
    });
});
