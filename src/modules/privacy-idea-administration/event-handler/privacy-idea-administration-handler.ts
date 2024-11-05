import { Injectable } from '@nestjs/common';
import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PrivacyIdeaAdministrationService } from '../privacy-idea-administration.service.js';

@Injectable()
export class PrivacyIdeaAdministrationServiceHandler {
    public constructor(
        private readonly privacyIdeaAdministrationService: PrivacyIdeaAdministrationService,
        private readonly logger: ClassLogger,
    ) {}

    @EventHandler(PersonRenamedEvent)
    public async handlePersonRenamedEvent(event: PersonRenamedEvent): Promise<void> {
        this.logger.info(`Received PersonRenamedEvent, personId:${event.personId}`);
        if (!event.referrer) throw new Error('Referrer is missing');

        await this.privacyIdeaAdministrationService.updateUsername(event.oldReferrer, event.referrer);
    }
}
