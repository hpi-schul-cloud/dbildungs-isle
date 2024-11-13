import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyIdeaAdministrationServiceHandler } from './privacy-idea-administration-handler.js';
import { PrivacyIdeaAdministrationService } from '../privacy-idea-administration.service.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';

describe('PrivacyIdeaAdministrationServiceHandler', () => {
    let handler: PrivacyIdeaAdministrationServiceHandler;
    let privacyIdeaAdministrationServiceMock: DeepMocked<PrivacyIdeaAdministrationService>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrivacyIdeaAdministrationServiceHandler,
                {
                    provide: PrivacyIdeaAdministrationService,
                    useValue: createMock<PrivacyIdeaAdministrationService>(),
                },
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
            ],
        }).compile();

        handler = module.get(PrivacyIdeaAdministrationServiceHandler);
        privacyIdeaAdministrationServiceMock = module.get(PrivacyIdeaAdministrationService);
        loggerMock = module.get(ClassLogger);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('handlePersonRenamedEvent', () => {
        it('should log info and call updateUsername on PrivacyIdeaAdministrationService', async () => {
            const event: PersonRenamedEvent = new PersonRenamedEvent(
                'person-id-123',
                'vorname',
                'familienname',
                'referrer',
                'old-referrer',
            );

            await handler.handlePersonRenamedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith(`Received PersonRenamedEvent, personId:${event.personId}`);
            expect(privacyIdeaAdministrationServiceMock.updateUsername).toHaveBeenCalledWith(
                event.oldReferrer,
                event.referrer,
            );
        });

        it('should throw an error if referrer is missing', async () => {
            const event: PersonRenamedEvent = new PersonRenamedEvent(
                'person-id-123',
                'vorname',
                'familienname',
                undefined,
                'old-referrer',
            );

            await expect(handler.handlePersonRenamedEvent(event)).rejects.toThrow('Referrer is missing');
        });
    });
});
