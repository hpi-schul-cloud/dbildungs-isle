import { GlobalValidationPipe } from './global-validation.pipe.js';

describe('GlobalValidationPipe', () => {
    describe('constructor', () => {
        it('should instantiate type', () => {
            expect(new GlobalValidationPipe()).toBeInstanceOf(GlobalValidationPipe);
        });
    });
});
