import { Inject, Injectable } from '@nestjs/common';
import { ClientRepresentation, KeycloakAdminClient } from '@s3pweb/keycloak-admin-client-cjs';

import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError, KeycloakClientError } from '../../../shared/error/index.js';
import { KC_SERVICE_CLIENT } from '../keycloak-client-providers.js';

@Injectable()
export class KeycloakClientService {
    public constructor(
        @Inject(KC_SERVICE_CLIENT)
        private readonly kcAdminClient: KeycloakAdminClient,
        private readonly logger: ClassLogger,
    ) {}

    public async updateClient(id: string, payload: ClientRepresentation): Promise<Result<undefined, DomainError>> {
        try {
            await this.kcAdminClient.clients.update({ id }, payload);

            return { ok: true, value: undefined };
        } catch (err) {
            this.logger.error(`Could not update client with ID ${id}`, err);

            return {
                ok: false,
                error: new KeycloakClientError('Could not update client'),
            };
        }
    }
}
