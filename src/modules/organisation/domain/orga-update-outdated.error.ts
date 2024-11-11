import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';

export class OrganisationUpdateOutdatedError extends OrganisationSpecificationError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Organisaton could not be updated because newer versions of Organisaton exist.`, undefined, details);
    }
}
