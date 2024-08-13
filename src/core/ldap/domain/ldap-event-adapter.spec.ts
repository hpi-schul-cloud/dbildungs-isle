import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { LdapModule } from '../ldap.module.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { RolleRepo } from '../../../modules/rolle/repo/rolle.repo.js';
import { faker } from '@faker-js/faker';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import { PersonenkontextDeletedEvent } from '../../../shared/events/personenkontext-deleted.event.js';
import { LdapEventAdapter } from './ldap-event-adapter.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { APP_PIPE } from '@nestjs/core';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';
import { EventService } from '../../eventbus/services/event.service.js';
import { Person } from '../../../modules/person/domain/person.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { Rolle } from '../../../modules/rolle/domain/rolle.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { OrganisationsTyp } from '../../../modules/organisation/domain/organisation.enums.js';

describe('LDAP Event Adapter', () => {
    let app: INestApplication;

    let sut: LdapEventAdapter;

    let eventServiceMock: DeepMocked<EventService>;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                MapperTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: false }),
                LdapModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
            ],
        })
            .overrideProvider(ClassLogger)
            .useValue(createMock<ClassLogger>())
            .overrideProvider(EventService)
            .useValue(createMock<EventService>())
            .overrideProvider(PersonRepository)
            .useValue(createMock<PersonRepository>())
            .overrideProvider(OrganisationRepository)
            .useValue(createMock<OrganisationRepository>())
            .overrideProvider(RolleRepo)
            .useValue(createMock<RolleRepo>())
            .compile();

        eventServiceMock = module.get(EventService);
        personRepositoryMock = module.get(PersonRepository);
        organisationRepositoryMock = module.get(OrganisationRepository);
        rolleRepoMock = module.get(RolleRepo);
        loggerMock = module.get(ClassLogger);

        sut = module.get(LdapEventAdapter);

        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        //await orm.close();
        await app.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('handlePersonenkontextDeletedEvent', () => {
        describe('when every entity is found in DB', () => {
            it('should info and trigger PersonenkontextDeleted2Event', async () => {
                const fakePersonId: string = faker.string.uuid();
                const fakeOrgaId: string = faker.string.uuid();
                const fakeRolleId: string = faker.string.uuid();

                const fakePerson: Person<true> = createMock<Person<true>>({
                    id: fakePersonId,
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                });
                const fakeOrga: Organisation<true> = createMock<Organisation<true>>({
                    id: fakeOrgaId,
                    typ: OrganisationsTyp.SCHULE,
                    kennung: faker.string.alpha({ length: 6 }),
                });
                const fakeRolle: Rolle<true> = createMock<Rolle<true>>({
                    id: fakeRolleId,
                    rollenart: RollenArt.LEHR,
                });
                personRepositoryMock.findById.mockResolvedValueOnce(fakePerson);
                organisationRepositoryMock.findById.mockResolvedValueOnce(fakeOrga);
                rolleRepoMock.findById.mockResolvedValueOnce(fakeRolle);

                const event: PersonenkontextDeletedEvent = new PersonenkontextDeletedEvent(
                    fakePersonId,
                    fakeOrgaId,
                    fakeRolleId,
                );

                await sut.handlePersonenkontextDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Received PersonenkontextDeletedEvent, personId:${event.personId}, orgaId:${event.organisationId}, rolleId:${event.rolleId}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledWith(
                    expect.objectContaining({
                        personData: {
                            id: fakePerson.id,
                            vorname: fakePerson.vorname,
                            familienname: fakePerson.familienname,
                            referrer: fakePerson.referrer,
                        },
                        kontextData: {
                            rolleId: fakeRolle.id,
                            rolle: fakeRolle.rollenart,
                            orgaId: fakeOrga.id,
                            orgaTyp: fakeOrga.typ,
                            orgaKennung: fakeOrga.kennung,
                        },
                    }),
                );
            });
        });

        describe('when person cannot be found', () => {
            it('should log error', async () => {
                const fakePersonId: string = faker.string.uuid();
                const fakeOrgaId: string = faker.string.uuid();
                const fakeRolleId: string = faker.string.uuid();

                personRepositoryMock.findById.mockResolvedValueOnce(undefined);

                const event: PersonenkontextDeletedEvent = new PersonenkontextDeletedEvent(
                    fakePersonId,
                    fakeOrgaId,
                    fakeRolleId,
                );

                await sut.handlePersonenkontextDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Received PersonenkontextDeletedEvent, personId:${event.personId}, orgaId:${event.organisationId}, rolleId:${event.rolleId}`,
                );
                expect(loggerMock.error).toHaveBeenCalledWith(`Could not find person for personId:${event.personId}`);
            });
        });

        describe('when organisation cannot be found', () => {
            it('should log error', async () => {
                const fakePersonId: string = faker.string.uuid();
                const fakeOrgaId: string = faker.string.uuid();
                const fakeRolleId: string = faker.string.uuid();

                personRepositoryMock.findById.mockResolvedValueOnce(createMock<Person<true>>());
                organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);

                const event: PersonenkontextDeletedEvent = new PersonenkontextDeletedEvent(
                    fakePersonId,
                    fakeOrgaId,
                    fakeRolleId,
                );

                await sut.handlePersonenkontextDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Received PersonenkontextDeletedEvent, personId:${event.personId}, orgaId:${event.organisationId}, rolleId:${event.rolleId}`,
                );
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not find organisation for orgaId:${event.organisationId}`,
                );
            });
        });

        describe('when rolle cannot be found', () => {
            it('should log error', async () => {
                const fakePersonId: string = faker.string.uuid();
                const fakeOrgaId: string = faker.string.uuid();
                const fakeRolleId: string = faker.string.uuid();

                personRepositoryMock.findById.mockResolvedValueOnce(createMock<Person<true>>());
                organisationRepositoryMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());
                rolleRepoMock.findById.mockResolvedValueOnce(undefined);

                const event: PersonenkontextDeletedEvent = new PersonenkontextDeletedEvent(
                    fakePersonId,
                    fakeOrgaId,
                    fakeRolleId,
                );

                await sut.handlePersonenkontextDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Received PersonenkontextDeletedEvent, personId:${event.personId}, orgaId:${event.organisationId}, rolleId:${event.rolleId}`,
                );
                expect(loggerMock.error).toHaveBeenCalledWith(`Could not find rolle for rolleId:${event.rolleId}`);
            });
        });
    });
});
