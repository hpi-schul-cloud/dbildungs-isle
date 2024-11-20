import { OxError } from '../../../shared/error/ox.error.js';

export class OxPrimaryMailNotEqualEmail1Error extends OxError {
    public constructor(message: string, details?: unknown[] | Record<string, unknown>) {
        super(message, 'OX_PRIMARY_MAIL_NOT_EQUAL_EMAIL1_ERROR', details);
    }
}
