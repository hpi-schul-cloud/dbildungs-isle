import { ExistingRolleUndefined } from './existing-rolle-undefined.error.js';

describe('ExistingRolleUndefined', () => {
    it('should create an error with the correct message and code', () => {
        const error: ExistingRolleUndefined = new ExistingRolleUndefined();

        expect(error).toBeInstanceOf(ExistingRolleUndefined);
        expect(error.details).toBeUndefined();
    });
});
