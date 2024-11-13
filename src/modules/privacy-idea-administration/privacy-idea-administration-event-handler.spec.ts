import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { PrivacyIdeaAdministrationEventHandler } from './privacy-idea-administration-event-handler.js';
import { PrivacyIdeaAdministrationService } from './privacy-idea-administration.service.js';
import { faker } from '@faker-js/faker';
import { TestingModule, Test } from '@nestjs/testing';
import { ConfigTestModule, LoggingTestModule } from '../../../test/utils/index.js';
import { PersonDeletedEvent } from '../../shared/events/person-deleted.event.js';
import { ResetTokenResponse, PrivacyIdeaToken } from './privacy-idea-api.types.js';

export const mockPrivacyIdeaToken: PrivacyIdeaToken = {
    active: true,
    count: 5,
    count_window: 10,
    description: 'Test token for mock data',
    failcount: 2,
    id: 12345,
    info: {
        hashlib: 'SHA-256',
        timeShift: '0',
        timeStep: '30',
        timeWindow: '5',
        tokenkind: 'software',
    },
    locked: false,
    maxfail: 3,
    otplen: 6,
    realms: ['exampleRealm'],
    resolver: 'exampleResolver',
    revoked: false,
    rollout_state: 'completed',
    serial: 'ABC123456',
    sync_window: 30,
    tokengroup: ['exampleGroup'],
    tokentype: 'TOTP',
    user_editable: true,
    user_id: 'user123',
    user_realm: 'userRealm',
    username: 'exampleUser',
};

describe('PrivacyIdeaAdministration Event Handler', () => {
    let module: TestingModule;

    let sut: PrivacyIdeaAdministrationEventHandler;
    let privacyIdeaAdministrationServiceMock: DeepMocked<PrivacyIdeaAdministrationService>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, LoggingTestModule],
            providers: [
                PrivacyIdeaAdministrationEventHandler,
                {
                    provide: PrivacyIdeaAdministrationService,
                    useValue: createMock<PrivacyIdeaAdministrationService>(),
                },
            ],
        }).compile();

        sut = module.get(PrivacyIdeaAdministrationEventHandler);
        privacyIdeaAdministrationServiceMock = module.get(PrivacyIdeaAdministrationService);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('handlePersonDeletedEvent', () => {
        let personId: string;
        let referrer: string;
        let emailAddress: string;
        let event: PersonDeletedEvent;
        let mockResetTokenResponse: ResetTokenResponse;

        beforeEach(() => {
            personId = faker.string.uuid();
            referrer = faker.string.alpha();
            emailAddress = faker.internet.email();
            event = new PersonDeletedEvent(personId, referrer, emailAddress);
            mockResetTokenResponse = createMock<ResetTokenResponse>();
        });

        describe('when person has privacyIDEA tokens', () => {
            it('should reset privacyIDEA tokens and delete person', async () => {
                privacyIdeaAdministrationServiceMock.getUserTokens.mockResolvedValueOnce([mockPrivacyIdeaToken]);
                privacyIdeaAdministrationServiceMock.resetToken.mockResolvedValueOnce(mockResetTokenResponse);
                privacyIdeaAdministrationServiceMock.deleteUserWrapper.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(`Received PersonDeletedEvent, personId:${event.personId}`);
                expect(privacyIdeaAdministrationServiceMock.resetToken).toHaveBeenCalledTimes(1);
                expect(privacyIdeaAdministrationServiceMock.deleteUserWrapper).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person has no privacyIDEA tokens', () => {
            it('should delete person', async () => {
                privacyIdeaAdministrationServiceMock.getUserTokens.mockResolvedValueOnce([]);
                privacyIdeaAdministrationServiceMock.resetToken.mockResolvedValueOnce(mockResetTokenResponse);
                privacyIdeaAdministrationServiceMock.deleteUserWrapper.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(`Received PersonDeletedEvent, personId:${personId}`);
                expect(privacyIdeaAdministrationServiceMock.resetToken).toHaveBeenCalledTimes(0);
                expect(privacyIdeaAdministrationServiceMock.deleteUserWrapper).toHaveBeenCalledTimes(1);
            });
        });
    });
});
