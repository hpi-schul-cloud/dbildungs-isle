import { DomainError } from './domain.error.js';

export class OxError extends DomainError {
    public constructor(
        message: string = 'Unknown OX-error',
        code: string = 'OX_ERROR',
        details?: unknown[] | Record<string, unknown>,
    ) {
        super(message, code, details);
    }
}
