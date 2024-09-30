import { PersonDomainError } from './person-domain.error.js';

export class PersonalnummerUpdateOutdatedError extends PersonDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(
            `Personalnummer could not be updated because newer versions of personalnummer for this person exist.`,
            undefined,
            details,
        );
    }
}
