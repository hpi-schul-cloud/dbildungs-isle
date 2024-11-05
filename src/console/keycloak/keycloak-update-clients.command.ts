import { ClientRepresentation } from '@s3pweb/keycloak-admin-client-cjs';
import { CommandRunner, SubCommand } from 'nest-commander';
import { readFile, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';

import { ClassLogger } from '../../core/logging/class-logger.js';
import { KeycloakClientService } from '../../modules/keycloak-administration/domain/keycloak-client.service.js';
import { DomainError } from '../../shared/error/domain.error.js';

@SubCommand({ name: 'update-clients', description: 'updates all keycloak clients', arguments: '<dir>' })
export class KeycloakUpdateClientsCommand extends CommandRunner {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly kcClientService: KeycloakClientService,
    ) {
        super();
    }

    private getPath(directory: string, file: string = ''): string {
        return join('keycloak-migrations', directory, 'clients', file);
    }

    public override async run(directory: [string]): Promise<void> {
        this.logger.info('Updating keycloak clients to latest version...');

        await this.migrateClients(directory[0]);

        this.logger.info('Finished keycloak migration.');
    }

    private async migrateClients(directory: string): Promise<void> {
        this.logger.info('Migrating keycloak clients to latest version...');

        const files: string[] = await readdir(this.getPath(directory));
        const jsonFiles: string[] = files.filter((filename: string) => filename.endsWith('.json'));

        for (const file of jsonFiles) {
            const clientId: string = parse(file).name;

            this.logger.info(`Migrating Client with ID ${clientId}`);

            // eslint-disable-next-line no-await-in-loop
            const payload: string = await readFile(this.getPath(directory, file), 'utf-8');

            // eslint-disable-next-line no-await-in-loop
            const result: Result<void, DomainError> = await this.kcClientService.updateClient(
                clientId,
                JSON.parse(payload) as ClientRepresentation,
            );

            if (!result.ok) {
                this.logger.error(`Could not update client! Aborting!`);
                throw result.error;
            }
        }

        this.logger.info('Finished clients migration.');
    }
}
