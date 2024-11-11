import { TokenError } from './token.error.js';

export class SoftwareTokenInitializationError extends TokenError {
    public constructor(message?: string, details?: unknown[] | Record<string, undefined>) {
        super(message ?? 'Fehler bei der Initialisieren des Softwaretokens', undefined, details);
    }
}
