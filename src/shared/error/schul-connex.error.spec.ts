import { SchulConnexError } from './schul-connex-error.js';

describe('SchulConnexError', () => {
    describe('The constructor', () => {
        it('should fit the contract', () => {
            const error: SchulConnexError = {
                title: 'An Error',
                description: 'Something bad',
                statusCode: 100,
                subcode: '100',
            };
            expect(error).toBeDefined();
        });
    });
});
