import { TokenError } from './token.error.js';

export class DeleteUserError extends TokenError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super('The deletion failed', undefined, details);
    }
}
