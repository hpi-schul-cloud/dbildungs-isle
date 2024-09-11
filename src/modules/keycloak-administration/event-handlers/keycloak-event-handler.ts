import { Injectable } from '@nestjs/common';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { OxUserCreatedEvent } from '../../../shared/events/ox-user-created.event.js';
import { KeycloakUserService } from '../domain/keycloak-user.service.js';
import { OxUserAttributesCreatedEvent } from '../../../shared/events/ox-user-attributes-created.event.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';

@Injectable()
export class KeycloakEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly kcUserService: KeycloakUserService,
        private readonly eventService: EventService,
    ) {}

    @EventHandler(OxUserCreatedEvent)
    public async handleOxUserCreatedEvent(event: OxUserCreatedEvent): Promise<void> {
        this.logger.info(
            `Received OxUserCreatedEvent personId:${event.personId}, userId:${event.userId}, userName:${event.userName} contextId:${event.contextId}, contextName:${event.contextName}`,
        );

        const updateResult: Result<void> = await this.kcUserService.updateOXUserAttributes(
            event.keycloakUsername,
            event.userName,
            event.contextName,
        );

        if (updateResult.ok) {
            return this.eventService.publish(
                new OxUserAttributesCreatedEvent(
                    event.personId,
                    event.keycloakUsername,
                    event.userName,
                    event.contextName,
                    event.primaryEmail,
                ),
            );
        }
    }
}
