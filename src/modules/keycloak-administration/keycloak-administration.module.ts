import { Module } from '@nestjs/common';

import { KeycloakAdminClient } from '@s3pweb/keycloak-admin-client-cjs';
import { KeycloakAdministrationService } from './domain/keycloak-admin-client.service.js';
import { KeycloakUserService } from './domain/keycloak-user.service.js';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { KeycloakConfigModule } from './keycloak-config.module.js';
import { KeycloakGroupRoleService } from './domain/keycloak-group-role.service.js';
import { KeycloakEventHandler } from './event-handlers/keycloak-event-handler.js';
import { EventModule } from '../../core/eventbus/event.module.js';

@Module({
    imports: [LoggerModule.register(KeycloakAdministrationModule.name), KeycloakConfigModule, EventModule],
    providers: [
        KeycloakAdminClient,
        KeycloakUserService,
        KeycloakGroupRoleService,
        KeycloakAdministrationService,
        KeycloakEventHandler,
    ],
    exports: [KeycloakUserService, KeycloakGroupRoleService],
})
export class KeycloakAdministrationModule {}
