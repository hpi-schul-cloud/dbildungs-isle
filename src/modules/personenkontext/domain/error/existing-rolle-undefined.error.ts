import { PersonenkontexteUpdateError } from './personenkontexte-update.error.js';

export class ExistingRolleUndefined extends PersonenkontexteUpdateError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Expected existingRollen to contain valid roles, but found undefined.`, details);
    }
}
