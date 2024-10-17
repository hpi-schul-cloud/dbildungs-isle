import { RolleDomainError } from './rolle-domain.error.js';

export class RolleUpdateOutdatedError extends RolleDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Rolle could not be updated because newer versions of rolle exist.`, undefined, details);
    }
}
