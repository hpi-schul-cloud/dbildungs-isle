import { PersonDomainError } from './person-domain.error.js';

export class PersonUpdateOutdatedError extends PersonDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Person could not be updated because newer version of person exist.`, undefined, details);
    }
}
