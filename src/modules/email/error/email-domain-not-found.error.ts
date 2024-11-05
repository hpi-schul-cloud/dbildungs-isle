import { DomainError } from '../../../shared/error/index.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';

export class EmailDomainNotFoundError extends DomainError {
    public constructor(
        personId: PersonID,
        organisationId: OrganisationID,
        details?: unknown[] | Record<string, unknown>,
    ) {
        super(
            `Could not find emailDomain in organisations for personId:${personId}, organisationsId:${JSON.stringify(organisationId)}`,
            'ENTITY_NOT_FOUND',
            details,
        );
    }
}
