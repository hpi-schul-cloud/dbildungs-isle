import { PersonDomainError } from './person-domain.error.js';

export class NotFoundOrNoPermissionError extends PersonDomainError {
    public constructor(entityId: string | undefined, details?: unknown[] | Record<string, undefined>) {
        super(
            `Person with id ${entityId} could not be found because it does not exist or permissions are insufficient`,
            entityId,
            details,
        );
    }
}
