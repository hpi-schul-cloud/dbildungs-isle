import { TokenError } from './token.error.js';

export class UserExistsError extends TokenError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super('The Username already exists', undefined, details);
    }
}
