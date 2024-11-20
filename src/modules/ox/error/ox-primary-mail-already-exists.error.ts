import { OxError } from '../../../shared/error/ox.error.js';

export class OxPrimaryMailAlreadyExistsError extends OxError {
    public constructor(message: string, details?: unknown[] | Record<string, unknown>) {
        super(message, 'OX_PRIMARY_MAIL_ALREADY_EXISTS_ERROR', details);
    }
}
