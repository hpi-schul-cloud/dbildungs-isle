import { PersonDomainError } from './person-domain.error.js';

export class PersonalnummerRequiredError extends PersonDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Person could not be created/updated because personalnummer is required`, undefined, details);
    }
}
