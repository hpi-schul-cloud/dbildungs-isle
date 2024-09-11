import { PersonDomainError } from './person-domain.error.js';

export class DownstreamKeycloakError extends PersonDomainError {
    public constructor(message: string, entityId: string | undefined, details?: unknown[] | Record<string, undefined>) {
        super(`Keycloak returned an error for person with id ${entityId}`, entityId, [details, message, entityId]);
    }
}
