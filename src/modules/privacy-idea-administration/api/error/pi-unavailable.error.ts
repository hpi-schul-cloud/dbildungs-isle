import { TokenError } from './token.error.js';

export class PIUnavailableError extends TokenError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super('PrivacyIDEA nicht erreichbar', undefined, details);
    }
}
