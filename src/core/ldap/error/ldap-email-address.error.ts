import { DomainError } from '../../../shared/error/index.js';

export class LdapEmailAddressError extends DomainError {
    public constructor(details?: unknown[] | Record<string, unknown>) {
        super(`LDAP error: EmailAddress Invalid`, 'INVALID_EMAIL_ADDRESS', details);
    }
}
