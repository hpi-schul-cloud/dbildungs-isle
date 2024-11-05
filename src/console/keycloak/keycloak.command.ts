import { Command, CommandRunner } from 'nest-commander';

import { ClassLogger } from '../../core/logging/class-logger.js';
import { KeycloakUpdateClientsCommand } from './keycloak-update-clients.command.js';

@Command({
    name: 'keycloak',
    arguments: '<sub-command>',
    description: 'runs commands to manage keycloak',
    subCommands: [KeycloakUpdateClientsCommand],
})
export class KeycloakCommand extends CommandRunner {
    public constructor(private readonly logger: ClassLogger) {
        super();
    }

    public override run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
        this.logger.info('Did you forget the sub command?');
        return Promise.resolve();
    }
}
