import { Injectable } from '@nestjs/common';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { KeycloakUserService } from '../domain/keycloak-user.service.js';
import { OxMetadataInKeycloakChangedEvent } from '../../../shared/events/ox-metadata-in-keycloak-changed.event.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';

@Injectable()
export class KeycloakEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly kcUserService: KeycloakUserService,
        private readonly eventService: EventService,
    ) {}

    @EventHandler(OxUserChangedEvent)
    public async handleOxUserChangedEvent(event: OxUserChangedEvent): Promise<void> {
        this.logger.info(
            `Received OxUserChangedEvent personId:${event.personId}, userId:${event.oxUserId}, userName:${event.oxUserName} contextId:${event.oxContextId}, contextName:${event.oxContextName}, primaryEmail:${event.primaryEmail}`,
        );

        const updateResult: Result<void> = await this.kcUserService.updateOXUserAttributes(
            event.keycloakUsername,
            event.oxUserName,
            event.oxContextName,
        );

        if (updateResult.ok) {
            return this.eventService.publish(
                new OxMetadataInKeycloakChangedEvent(
                    event.personId,
                    event.keycloakUsername,
                    event.oxUserId,
                    event.oxUserName,
                    event.oxContextName,
                    event.primaryEmail,
                ),
            );
        }
    }
}
