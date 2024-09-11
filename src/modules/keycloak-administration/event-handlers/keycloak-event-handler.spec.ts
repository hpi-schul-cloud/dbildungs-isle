import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { KeycloakUserService } from '../domain/keycloak-user.service.js';
import { KeycloakEventHandler } from './keycloak-event-handler.js';
import { OxUserCreatedEvent } from '../../../shared/events/ox-user-created.event.js';
import { faker } from '@faker-js/faker';
import { OXContextID, OXContextName, OXUserID, OXUserName } from '../../../shared/types/ox-ids.types.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';

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

    describe('handleOxUserCreatedEvent', () => {
        it('should log info and call KeycloakUserService', async () => {
            const fakePersonID: PersonID = faker.string.uuid();
            const fakeOXUserID: OXUserID = faker.string.uuid();
            const fakeOXContextID: OXContextID = faker.string.uuid();
            const fakeOXUserName: OXUserName = faker.internet.userName();
            const fakeOXContextName: OXContextName = 'context1';
            const fakeEmail: string = faker.internet.email();
            await sut.handleOxUserCreatedEvent(
                new OxUserCreatedEvent(
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
                `Received OxUserCreatedEvent personId:${fakePersonID}, userId:${fakeOXUserID}, userName:${fakeOXUserName} contextId:${fakeOXContextID}, contextName:${fakeOXContextName}`,
            );
            expect(keycloakUserServiceMock.updateOXUserAttributes).toHaveBeenCalledTimes(1);
        });
    });
});
