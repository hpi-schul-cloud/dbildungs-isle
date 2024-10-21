import { DomainError } from '../../../shared/error/index.js';

export class ImportDomainError extends DomainError {
    public constructor(
        public override readonly message: string,
        public readonly entityId: string | undefined,
        details?: unknown[] | Record<string, undefined>,
    ) {
        super(message, 'DATA_COULD_NOT_BE_IMPORTED', details);
    }
}
