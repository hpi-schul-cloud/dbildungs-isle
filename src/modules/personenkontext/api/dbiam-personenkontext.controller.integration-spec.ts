import { faker } from '@faker-js/faker';
import { MikroORM } from '@mikro-orm/core';
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
import { GlobalValidationPipe } from '../../../shared/validation/index.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { PersonDo } from '../../person/domain/person.do.js';
import { PersonRepo } from '../../person/persistence/person.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { PersonenKontextApiModule } from '../personenkontext-api.module.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';

function createPersonenkontext<WasPersisted extends boolean>(
    this: void,
    withId: WasPersisted,
    params: Partial<Personenkontext<boolean>> = {},
): Personenkontext<WasPersisted> {
    const personenkontext: Personenkontext<WasPersisted> = Personenkontext.construct<boolean>(
        withId ? faker.string.uuid() : undefined,
        withId ? faker.date.past() : undefined,
        withId ? faker.date.recent() : undefined,
        faker.string.uuid(),
        faker.string.uuid(),
        faker.string.uuid(),
    );

    Object.assign(personenkontext, params);

    return personenkontext;
}

describe('dbiam Personenkontext API', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let personenkontextRepo: DBiamPersonenkontextRepo;

    let personRepo: PersonRepo;
    let organisationRepo: OrganisationRepo;
    let rolleRepo: RolleRepo;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                MapperTestModule,
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                PersonenKontextApiModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
            ],
        }).compile();

        orm = module.get(MikroORM);
        personenkontextRepo = module.get(DBiamPersonenkontextRepo);
        personRepo = module.get(PersonRepo);
        organisationRepo = module.get(OrganisationRepo);
        rolleRepo = module.get(RolleRepo);

        await DatabaseTestModule.setupDatabase(orm);
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

    describe('/GET personenkontexte for person', () => {
        it('should return all personenkontexte for the person', async () => {
            const personA: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
            const personB: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
            await Promise.all([
                personenkontextRepo.save(createPersonenkontext(false, { personId: personA.id })),
                personenkontextRepo.save(createPersonenkontext(false, { personId: personA.id })),
                personenkontextRepo.save(createPersonenkontext(false, { personId: personB.id })),
            ]);

            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenkontext/${personA.id}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(2);
        });

        it('should return empty list', async () => {
            const response: Response = await request(app.getHttpServer() as App)
                .get(`/dbiam/personenkontext/${faker.string.uuid()}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body).toHaveLength(0);
        });
    });

    describe('/POST create personenkontext', () => {
        it('should return created personenkontext', async () => {
            const person: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
            const organisation: OrganisationDo<true> = await organisationRepo.save(DoFactory.createOrganisation(false));
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));

            const response: Response = await request(app.getHttpServer() as App)
                .post('/dbiam/personenkontext')
                .send({ personId: person.id, organisationId: organisation.id, rolleId: rolle.id });

            expect(response.status).toBe(201);
        });

        it('should return created personenkontext when Klasse specifications are met', async () => {
            //create lehrer on Schule
            const lehrer: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
            const schuleDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SCHULE,
            });
            const lehrerRolleDummy: Rolle<false> = DoFactory.createRolle(false, { rollenart: RollenArt.LEHR });
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);
            const lehrerRolle: Rolle<true> = await rolleRepo.save(lehrerRolleDummy);
            await personenkontextRepo.save(Personenkontext.createNew(lehrer.id, schule.id, lehrerRolle.id));

            const klasseDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: schule.id,
            });
            const klasse: OrganisationDo<true> = await organisationRepo.save(klasseDo);
            const response: Response = await request(app.getHttpServer() as App)
                .post('/dbiam/personenkontext')
                .send({
                    personId: lehrer.id,
                    organisationId: klasse.id,
                    rolleId: lehrerRolle.id,
                });

            expect(response.status).toBe(201);
        });

        it('should return error if personenkontext already exists', async () => {
            const person: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
            const organisation: OrganisationDo<true> = await organisationRepo.save(DoFactory.createOrganisation(false));
            const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
            const personenkontext: Personenkontext<true> = await personenkontextRepo.save(
                Personenkontext.createNew(person.id, organisation.id, rolle.id),
            );

            const response: Response = await request(app.getHttpServer() as App)
                .post('/dbiam/personenkontext')
                .send({
                    personId: personenkontext.personId,
                    organisationId: personenkontext.organisationId,
                    rolleId: personenkontext.rolleId,
                });

            expect(response.status).toBe(400);
        });

        it('should return error if references do not exist', async () => {
            const personenkontext: Personenkontext<false> = createPersonenkontext(false);

            const response: Response = await request(app.getHttpServer() as App)
                .post('/dbiam/personenkontext')
                .send({
                    personId: personenkontext.personId,
                    organisationId: personenkontext.organisationId,
                    rolleId: personenkontext.rolleId,
                });

            expect(response.status).toBe(404);
        });

        describe('should return error if specifications are not satisfied', () => {
            it('when organisation is not found', async () => {
                const person: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
                const rolle: Rolle<true> = await rolleRepo.save(DoFactory.createRolle(false));
                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: faker.string.uuid(),
                        rolleId: rolle.id,
                    });

                expect(response.status).toBe(404);
            });

            it('when rolle is not found', async () => {
                const person: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
                const organisation: OrganisationDo<true> = await organisationRepo.save(
                    DoFactory.createOrganisation(false),
                );
                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: faker.string.uuid(),
                    });

                expect(response.status).toBe(404);
            });

            it('when rollenart of rolle is not LEHR or LERN', async () => {
                const orgaDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                    typ: OrganisationsTyp.KLASSE,
                });
                const rolleDummy: Rolle<false> = DoFactory.createRolle(false, { rollenart: RollenArt.SYSADMIN });

                const person: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
                const organisation: OrganisationDo<true> = await organisationRepo.save(orgaDo);
                const rolle: Rolle<true> = await rolleRepo.save(rolleDummy);
                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: person.id,
                        organisationId: organisation.id,
                        rolleId: rolle.id,
                    });

                expect(response.status).toBe(400);
            });

            it('when rollenart for Schule and Klasse are not equal', async () => {
                //create admin on Schule
                const admin: PersonDo<true> = await personRepo.save(DoFactory.createPerson(false));
                const schuleDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                    typ: OrganisationsTyp.SCHULE,
                });
                const adminRolleDummy: Rolle<false> = DoFactory.createRolle(false, { rollenart: RollenArt.ORGADMIN });

                const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);
                const adminRolle: Rolle<true> = await rolleRepo.save(adminRolleDummy);
                await personenkontextRepo.save(Personenkontext.createNew(admin.id, schule.id, adminRolle.id));

                const klasseDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: schule.id,
                });
                const lehrRolleDummy: Rolle<false> = DoFactory.createRolle(false, { rollenart: RollenArt.LEHR });
                const lehrer: PersonDo<true> = admin;
                const klasse: OrganisationDo<true> = await organisationRepo.save(klasseDo);
                const lehrRolle: Rolle<true> = await rolleRepo.save(lehrRolleDummy);
                const response: Response = await request(app.getHttpServer() as App)
                    .post('/dbiam/personenkontext')
                    .send({
                        personId: lehrer.id,
                        organisationId: klasse.id,
                        rolleId: lehrRolle.id,
                    });

                expect(response.status).toBe(400);
            });
        });
    });
});
