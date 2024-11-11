import { TokenError } from './token.error.js';

export class TokenStateError extends TokenError {
    public constructor(message?: string, details?: unknown[] | Record<string, undefined>) {
        super(message ?? 'Fehler bei der Abrufen des Token Status', undefined, details);
    }
}
