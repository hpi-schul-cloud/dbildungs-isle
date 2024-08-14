import { MikroORM } from '@mikro-orm/core';
import { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';

import { LdapModule } from '../ldap.module.js';
import { OrganisationApiModule } from '../../../modules/organisation/organisation-api.module.js';
import { PersonenKontextApiModule } from '../../../modules/personenkontext/personenkontext-api.module.js';
import { LdapEventHandler } from './ldap-event-handler.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { LdapClientService } from './ldap-client.service.js';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { OrganisationsTyp } from '../../../modules/organisation/domain/organisation.enums.js';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { RolleRepo } from '../../../modules/rolle/repo/rolle.repo.js';
import { faker } from '@faker-js/faker';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { SchuleDeletedEvent } from '../../../shared/events/schule-deleted.event.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import { DBiamPersonenkontextRepo } from '../../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextFactory } from '../../../modules/personenkontext/domain/personenkontext.factory.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';

describe('LDAP Event Handler', () => {
    let app: INestApplication;
    let orm: MikroORM;

    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;

    let ldapEventHandler: LdapEventHandler;
    let ldapClientServiceMock: DeepMocked<LdapClientService>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                LdapModule,
                MapperTestModule,
                OrganisationApiModule,
                PersonenKontextApiModule,
            ],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
            ],
        })
            .overrideProvider(LdapClientService)
            .useValue(createMock<LdapClientService>())
            .overrideProvider(OrganisationRepository)
            .useValue(createMock<OrganisationRepository>())
            .overrideProvider(PersonRepository)
            .useValue(createMock<PersonRepository>())
            .overrideProvider(PersonenkontextFactory)
            .useClass(PersonenkontextFactory)
            .overrideProvider(RolleRepo)
            .useValue(createMock<RolleRepo>())
            .overrideProvider(DBiamPersonenkontextRepo)
            .useValue(createMock<DBiamPersonenkontextRepo>())
            .compile();

        orm = module.get(MikroORM);

        organisationRepositoryMock = module.get(OrganisationRepository);

        ldapEventHandler = module.get(LdapEventHandler);
        ldapClientServiceMock = module.get(LdapClientService);

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));
        app = module.createNestApplication();
        await app.init();
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await app.close();
    });

    beforeEach(async () => {
        jest.resetAllMocks();
        await DatabaseTestModule.clearDatabase(orm);
    });

    describe('asyncSchuleCreatedEventHandler', () => {
        describe('when type is SCHULE and creation is successful', () => {
            it('should execute without errors', async () => {
                const organisation: Organisation<true> = createMock<Organisation<true>>({
                    id: faker.string.uuid(),
                    typ: OrganisationsTyp.SCHULE,
                });

                const event: SchuleCreatedEvent = new SchuleCreatedEvent(organisation.id);
                const result: Result<Organisation<true>> = {
                    ok: true,
                    value: createMock<Organisation<true>>(),
                };

                organisationRepositoryMock.findById.mockResolvedValueOnce(organisation);
                ldapClientServiceMock.createOrganisation.mockResolvedValueOnce(result);

                await ldapEventHandler.handleSchuleCreatedEvent(event);
                expect(ldapClientServiceMock.createOrganisation).toHaveBeenCalledTimes(1);
            });
        });

        describe('when type is SCHULE and creation fails', () => {
            it('should execute without errors', async () => {
                const organisation: Organisation<true> = createMock<Organisation<true>>({
                    id: faker.string.uuid(),
                    typ: OrganisationsTyp.SCHULE,
                });

                const event: SchuleCreatedEvent = new SchuleCreatedEvent(organisation.id);
                const result: Result<Organisation<true>> = {
                    ok: false,
                    error: new Error(),
                };

                organisationRepositoryMock.findById.mockResolvedValueOnce(organisation);
                ldapClientServiceMock.createOrganisation.mockResolvedValueOnce(result);

                await ldapEventHandler.handleSchuleCreatedEvent(event);
                expect(ldapClientServiceMock.createOrganisation).toHaveBeenCalledTimes(1);
            });
        });

        describe('when type is SCHULE and organisation cannot be found', () => {
            it('should execute without errors', async () => {
                const event: SchuleCreatedEvent = new SchuleCreatedEvent(faker.string.uuid());

                organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);

                await ldapEventHandler.handleSchuleCreatedEvent(event);
                expect(ldapClientServiceMock.createOrganisation).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('asyncSchuleDeletedEventHandler', () => {
        describe('when type is SCHULE and deletion is successful', () => {
            it('should execute without errors', async () => {
                const organisation: Organisation<true> = createMock<Organisation<true>>({
                    name: 'TestSchule',
                    typ: OrganisationsTyp.SCHULE,
                    kennung: '1234567',
                });

                const event: SchuleDeletedEvent = new SchuleDeletedEvent(organisation.id);
                const result: Result<Organisation<true>> = {
                    ok: true,
                    value: createMock<Organisation<true>>(),
                };

                organisationRepositoryMock.findById.mockResolvedValueOnce(organisation);
                ldapClientServiceMock.deleteOrganisation.mockResolvedValueOnce(result);

                await ldapEventHandler.handleSchuleDeletedEvent(event);
                expect(ldapClientServiceMock.deleteOrganisation).toHaveBeenCalledTimes(1);
            });
        });

        describe('when type is SCHULE and deletion fails', () => {
            it('should execute without errors', async () => {
                const organisation: Organisation<true> = createMock<Organisation<true>>({
                    name: 'TestSchule',
                    typ: OrganisationsTyp.SCHULE,
                    kennung: '1234567',
                });

                const event: SchuleDeletedEvent = new SchuleDeletedEvent(organisation.id);
                const result: Result<Organisation<true>> = {
                    ok: false,
                    error: new Error(),
                };

                organisationRepositoryMock.findById.mockResolvedValueOnce(organisation);
                ldapClientServiceMock.deleteOrganisation.mockResolvedValueOnce(result);

                await ldapEventHandler.handleSchuleDeletedEvent(event);
                expect(ldapClientServiceMock.deleteOrganisation).toHaveBeenCalledTimes(1);
            });
        });

        describe('when type is SCHULE and organisation cannot be found', () => {
            it('should execute without errors', async () => {
                const event: SchuleDeletedEvent = new SchuleDeletedEvent(faker.string.uuid());

                organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);

                await ldapEventHandler.handleSchuleDeletedEvent(event);
                expect(ldapClientServiceMock.deleteOrganisation).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('handlePersonenkontextUpdatedEvent', () => {
        it('should call ldap client for every new personenkontext with correct role', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [
                    {
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                    },
                    {
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                    },
                ],
                [],
                [],
            );

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(1);
        });

        it('should call ldap client for every deleted personenkontext with correct role', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                    },
                    {
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                    },
                ],
                [],
            );

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.deleteLehrer).toHaveBeenCalledTimes(1);
        });

        describe('when ldap client fails', () => {
            it('should execute without errors, if creation of lehrer fails', async () => {
                const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                    {
                        id: faker.string.uuid(),
                        vorname: faker.person.firstName(),
                        familienname: faker.person.lastName(),
                        referrer: faker.internet.userName(),
                    },
                    [
                        {
                            orgaId: faker.string.uuid(),
                            rolle: RollenArt.LEHR,
                            rolleId: faker.string.uuid(),
                            orgaKennung: faker.string.numeric(7),
                        },
                    ],
                    [],
                    [],
                );
                ldapClientServiceMock.createLehrer.mockResolvedValueOnce({ ok: false, error: new Error('Error') });

                await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

                expect(ldapClientServiceMock.createLehrer).toHaveBeenCalledTimes(1);
            });
        });

        it('should execute without errors, if deletion of lehrer fails', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                {
                    id: faker.string.uuid(),
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                    },
                ],
                [],
            );
            ldapClientServiceMock.deleteLehrer.mockResolvedValueOnce({ ok: false, error: new Error('Error') });

            await ldapEventHandler.handlePersonenkontextUpdatedEvent(event);

            expect(ldapClientServiceMock.deleteLehrer).toHaveBeenCalledTimes(1);
        });
    });
});
