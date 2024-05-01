import { DomainError } from '../../../../shared/error/index.js';

export class KlasseNurVonSchuleAdministriertError extends DomainError {
    public constructor(entityId?: string, details?: unknown[] | Record<string, undefined>) {
        super(
            `Organisation with ID ${entityId} could not be updated because it violates Klasse-nur-von-Schule-administriert specification`,
            'ENTITY_COULD_NOT_BE_UPDATED',
            details,
        );
    }
}
