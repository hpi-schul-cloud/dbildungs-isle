import { DomainError } from '../../../../shared/error/index.js';

export class KlassenNameAnSchuleEindeutigError extends DomainError {
    public constructor(entityId?: string, details?: unknown[] | Record<string, undefined>) {
        super(
            `Organisation with ID ${entityId} could not be updated because it violates Klassen-Name-an-Schule-eindeutig specification`,
            'ENTITY_COULD_NOT_BE_UPDATED',
            details,
        );
    }
}
