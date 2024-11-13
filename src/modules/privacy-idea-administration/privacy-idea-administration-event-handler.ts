import { Injectable } from '@nestjs/common';
import { PrivacyIdeaAdministrationService } from './privacy-idea-administration.service.js';
import { EventHandler } from '../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { PersonDeletedEvent } from '../../shared/events/person-deleted.event.js';
import { PrivacyIdeaToken } from './privacy-idea-api.types.js';

@Injectable()
export class PrivacyIdeaAdministrationEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly privacyIdeaAdministrationService: PrivacyIdeaAdministrationService,
    ) {}

    @EventHandler(PersonDeletedEvent)
    public async handlePersonDeletedEvent(event: PersonDeletedEvent): Promise<void> {
        this.logger.info(`Received PersonDeletedEvent, personId:${event.personId}`);
        const userTokens: PrivacyIdeaToken[] = await this.privacyIdeaAdministrationService.getUserTokens(
            event.referrer,
        );
        if (userTokens.length > 0) {
            await this.privacyIdeaAdministrationService.resetToken(event.referrer);
        }
        await this.privacyIdeaAdministrationService.deleteUserWrapper(event.referrer);
    }
}
