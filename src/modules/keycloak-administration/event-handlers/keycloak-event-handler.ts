import { Injectable } from '@nestjs/common';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { KeycloakUserService } from '../domain/keycloak-user.service.js';
import { OxMetadataInKeycloakChangedEvent } from '../../../shared/events/ox-metadata-in-keycloak-changed.event.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { PersonenkontextMigrationRuntype } from '../../personenkontext/domain/personenkontext.enums.js';
import { OxConfig } from '../../../shared/config/ox.config.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { OXContextName } from '../../../shared/types/ox-ids.types.js';

@Injectable()
export class KeycloakEventHandler {
    private readonly contextName: OXContextName;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly kcUserService: KeycloakUserService,
        private readonly eventService: EventService,
        configService: ConfigService<ServerConfig>,
    ) {
        const oxConfig: OxConfig = configService.getOrThrow<OxConfig>('OX');
        this.contextName = oxConfig.CONTEXT_NAME;
    }

    @EventHandler(PersonenkontextCreatedMigrationEvent)
    public async handlePersonenkontextCreatedMigrationEvent(
        event: PersonenkontextCreatedMigrationEvent,
    ): Promise<void> {
        this.logger.info(
            `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Received PersonenkontextCreatedMigrationEvent`,
        );
        if (
            event.email &&
            event.createdKontextPerson.referrer &&
            event.createdKontextRolle.rollenart == RollenArt.LEHR &&
            event.migrationRunType === PersonenkontextMigrationRuntype.STANDARD
        ) {
            this.logger.info(
                `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / UpdateOXUserAttributes criteria fulfilled, trying to updateOXUserAttributes`,
            );

            const updateResult: Result<void> = await this.kcUserService.updateOXUserAttributes(
                event.createdKontextPerson.referrer,
                event.createdKontextPerson.referrer,
                this.contextName,
            );
            if (!updateResult.ok) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Updating user in keycloak failed for OxUserChangedEvent`,
                );
            }
        } else {
            this.logger.info(
                `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / UpdateOXUserAttributes criteria not fulfilled, no action taken`,
            );
        }
    }

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
        } else {
            this.logger.error(
                `Updating user in Keycloak FAILED for OxUserChangedEvent, personId:${event.personId}, userId:${event.oxUserId}, userName:${event.oxUserName} contextId:${event.oxContextId}, contextName:${event.oxContextName}, primaryEmail:${event.primaryEmail}`,
            );
            this.logger.error(
                `OxMetadataInKeycloakChangedEvent will NOT be published, email-address for personId:${event.personId} in REQUESTED status will NOT be ENABLED!`,
            );
        }
    }
}
