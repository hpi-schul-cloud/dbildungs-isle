import { DomainError } from '../../../shared/error/index.js';

export class LdapModifyEmailError extends DomainError {
    public constructor(details?: unknown[] | Record<string, unknown>) {
        super(
            `LDAP error: Modifying mailPrimaryAddress and mailAlternativeAddress FAILED`,
            'LDAP_EMAIL_MODIFICATION_FAILED',
            details,
        );
    }
}
