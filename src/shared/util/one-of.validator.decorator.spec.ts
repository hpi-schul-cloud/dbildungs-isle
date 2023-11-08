import { IsNotEmpty, ValidationError, isInt, isString, validateSync } from 'class-validator';
import { OneOf } from './one-of.validator.decorator.js';

describe('OneOf decorator', () => {
    class Test {
        @OneOf(isInt, isString)
        @IsNotEmpty()
        public test?: number | string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public constructor(test: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.test = test;
        }
    }

    it('should validate int', () => {
        const errors: ValidationError[] = validateSync(new Test(5));

        expect(errors.length).toBe(0);
    });

    it('should validate string', () => {
        const errors: ValidationError[] = validateSync(new Test('TEST'));

        expect(errors.length).toBe(0);
    });

    it('should fail on boolean', () => {
        const errors: ValidationError[] = validateSync(new Test(true));

        expect(errors.length).toBeGreaterThan(0);
    });
});
