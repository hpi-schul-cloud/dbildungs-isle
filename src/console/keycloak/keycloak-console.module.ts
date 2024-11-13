import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logging/logger.module.js';
import { KeycloakAdministrationModule } from '../../modules/keycloak-administration/keycloak-administration.module.js';
import { KeycloakUpdateClientsCommand } from './keycloak-update-clients.command.js';
import { KeycloakCommand } from './keycloak.command.js';

@Module({
    imports: [KeycloakAdministrationModule, LoggerModule.register(KeycloakConsoleModule.name)],
    providers: [KeycloakCommand, KeycloakUpdateClientsCommand],
    exports: [KeycloakCommand],
})
export class KeycloakConsoleModule {}
