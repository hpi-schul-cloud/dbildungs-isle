import { OrganisationSpecificationError } from './organisation-specification.error.js';

export class EmailAdressOnOrganisationTypError extends OrganisationSpecificationError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(
            `Organisation Entity Could not be created/updated because this organisation typ can not have an email adress`,
            undefined,
            details,
        );
    }
}
