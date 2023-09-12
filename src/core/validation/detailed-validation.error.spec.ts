import { DetailedValidationError } from './detailed-validation.error.js';

describe('DetailedValidationError', () => {
    describe('Constructor', () => {
        it('Should instantiate an instance', () => {
            expect(new DetailedValidationError([], null, 'For testing purposes')).toBeInstanceOf(
                DetailedValidationError,
            );
        });
    });
});
