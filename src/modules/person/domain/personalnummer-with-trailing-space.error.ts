import { PersonDomainError } from './person-domain.error.js';

export class PersonalNummerForPersonWithTrailingSpaceError extends PersonDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Person could not be created/updated because Personalnummer contains trailing space`, undefined, details);
    }
}
