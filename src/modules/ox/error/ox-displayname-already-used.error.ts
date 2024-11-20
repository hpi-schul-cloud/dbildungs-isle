import { OxError } from '../../../shared/error/ox.error.js';

export class OxDisplaynameAlreadyUsedError extends OxError {
    public constructor(message: string, details?: unknown[] | Record<string, unknown>) {
        super(message, 'OX_DISPLAY_NAME_ALREADY_USED_ERROR', details);
    }
}
