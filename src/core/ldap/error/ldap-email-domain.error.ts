import { DomainError } from '../../../shared/error/index.js';

export class LdapEmailDomainError extends DomainError {
    public constructor(details?: unknown[] | Record<string, unknown>) {
        super(`LDAP error: Invalid email-domain for organisation`, 'INVALID_EMAIL_DOMAIN', details);
    }
}
