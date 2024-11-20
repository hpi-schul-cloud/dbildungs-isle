import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { KeycloakUserService } from '../domain/keycloak-user.service.js';
import { KeycloakEventHandler } from './keycloak-event-handler.js';
import { faker } from '@faker-js/faker';
import { OXContextID, OXContextName, OXUserID, OXUserName } from '../../../shared/types/ox-ids.types.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';
import { KeycloakClientError } from '../../../shared/error/keycloak-client.error.js';
import { PersonenkontextMigrationRuntype } from '../../personenkontext/domain/personenkontext.enums.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { Person } from '../../person/domain/person.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';

describe('KeycloakEventHandler', () => {
    let module: TestingModule;

    let sut: KeycloakEventHandler;
    let loggerMock: DeepMocked<ClassLogger>;
    let keycloakUserServiceMock: DeepMocked<KeycloakUserService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                KeycloakEventHandler,
                EventService,
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
            ],
        }).compile();

        sut = module.get(KeycloakEventHandler);
        loggerMock = module.get(ClassLogger);
        keycloakUserServiceMock = module.get(KeycloakUserService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('handlePersonenkontextCreatedMigrationEvent', () => {
        const migrationType: PersonenkontextMigrationRuntype = PersonenkontextMigrationRuntype.STANDARD;

        let personenkontext: Personenkontext<true>;
        let person: Person<true>;
        let rolle: Rolle<true>;
        let orga: Organisation<true>;

        beforeEach(() => {
            personenkontext = createMock<Personenkontext<true>>();
            person = createMock<Person<true>>();
            rolle = createMock<Rolle<true>>();
            orga = createMock<Organisation<true>>();
        });

        it('should do nothing', async () => {
            const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                migrationType,
                personenkontext,
                person,
                rolle,
                orga,
                'test@schule-spsh.de',
            );

            await sut.handlePersonenkontextCreatedMigrationEvent(event);
            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.stringContaining('UpdateOXUserAttributes criteria not fulfilled, no action taken'),
            );
            expect(keycloakUserServiceMock.updateOXUserAttributes).not.toHaveBeenCalled();
        });

        it('should successfully call updateOXUserAttributes', async () => {
            person.email = faker.internet.email();
            person.referrer = faker.internet.userName();
            rolle.rollenart = RollenArt.LEHR;

            const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                migrationType,
                personenkontext,
                person,
                rolle,
                orga,
                'test@schule-spsh.de',
            );

            keycloakUserServiceMock.updateOXUserAttributes.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            await sut.handlePersonenkontextCreatedMigrationEvent(event);
            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.stringContaining('UpdateOXUserAttributes criteria fulfilled, trying to updateOXUserAttributes'),
            );
            expect(loggerMock.error).not.toHaveBeenCalledWith(
                expect.stringContaining('Updating user in keycloak failed for OxUserChangedEvent'),
            );
            expect(keycloakUserServiceMock.updateOXUserAttributes).toHaveBeenCalledTimes(1);
        });

        it('should log error if updateOXUserAttributes fails', async () => {
            person.email = faker.internet.email();
            person.referrer = faker.internet.userName();
            rolle.rollenart = RollenArt.LEHR;

            const event: PersonenkontextCreatedMigrationEvent = new PersonenkontextCreatedMigrationEvent(
                migrationType,
                personenkontext,
                person,
                rolle,
                orga,
                'test@schule-spsh.de',
            );

            keycloakUserServiceMock.updateOXUserAttributes.mockResolvedValueOnce({
                ok: false,
                error: new KeycloakClientError('Could not update user-attributes'),
            });

            await sut.handlePersonenkontextCreatedMigrationEvent(event);
            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.stringContaining('UpdateOXUserAttributes criteria fulfilled, trying to updateOXUserAttributes'),
            );
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining('Updating user in keycloak failed for OxUserChangedEvent'),
            );
            expect(keycloakUserServiceMock.updateOXUserAttributes).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleOxUserCreatedEvent', () => {
        let fakePersonID: PersonID;
        let fakeOXUserID: OXUserID;
        let fakeOXContextID: OXContextID;
        let fakeOXUserName: OXUserName;
        let fakeOXContextName: OXContextName;
        let fakeEmail: string;

        beforeEach(() => {
            fakePersonID = faker.string.uuid();
            fakeOXUserID = faker.string.uuid();
            fakeOXContextID = faker.string.uuid();
            fakeOXUserName = faker.internet.userName();
            fakeOXContextName = 'context1';
            fakeEmail = faker.internet.email();
        });
        it('should log info and call KeycloakUserService', async () => {
            keycloakUserServiceMock.updateOXUserAttributes.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });
            await sut.handleOxUserChangedEvent(
                new OxUserChangedEvent(
                    fakePersonID,
                    faker.internet.userName(),
                    fakeOXUserID,
                    fakeOXUserName,
                    fakeOXContextID,
                    fakeOXContextName,
                    fakeEmail,
                ),
            );
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Received OxUserChangedEvent personId:${fakePersonID}, userId:${fakeOXUserID}, userName:${fakeOXUserName} contextId:${fakeOXContextID}, contextName:${fakeOXContextName}, primaryEmail:${fakeEmail}`,
            );
            expect(keycloakUserServiceMock.updateOXUserAttributes).toHaveBeenCalledTimes(1);
        });

        describe('when updating user-attributes fails', () => {
            it('should log info and call KeycloakUserService', async () => {
                keycloakUserServiceMock.updateOXUserAttributes.mockResolvedValueOnce({
                    ok: false,
                    error: new KeycloakClientError('Could not update user-attributes'),
                });

                await sut.handleOxUserChangedEvent(
                    new OxUserChangedEvent(
                        fakePersonID,
                        faker.internet.userName(),
                        fakeOXUserID,
                        fakeOXUserName,
                        fakeOXContextID,
                        fakeOXContextName,
                        fakeEmail,
                    ),
                );

                expect(loggerMock.info).toHaveBeenLastCalledWith(
                    `Received OxUserChangedEvent personId:${fakePersonID}, userId:${fakeOXUserID}, userName:${fakeOXUserName} contextId:${fakeOXContextID}, contextName:${fakeOXContextName}, primaryEmail:${fakeEmail}`,
                );
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Updating user in Keycloak FAILED for OxUserChangedEvent, personId:${fakePersonID}, userId:${fakeOXUserID}, userName:${fakeOXUserName} contextId:${fakeOXContextID}, contextName:${fakeOXContextName}, primaryEmail:${fakeEmail}`,
                );
                expect(loggerMock.error).toHaveBeenLastCalledWith(
                    `OxMetadataInKeycloakChangedEvent will NOT be published, email-address for personId:${fakePersonID} in REQUESTED status will NOT be ENABLED!`,
                );
            });
        });
    });
});
