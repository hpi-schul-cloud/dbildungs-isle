import { plainToInstance } from 'class-transformer';
import { TransformToArray } from './array-transform.validator.js';

class TestClass {
    @TransformToArray()
    public value!: string[];
}

describe('TransformToArray', () => {
    it('should convert value to single element array', () => {
        const testInstance: TestClass = plainToInstance(TestClass, {
            value: 'Test',
        });

        expect(testInstance.value).toBeInstanceOf(Array);
        expect(testInstance.value).toEqual(['Test']);
    });

    it('should keep array as-is', () => {
        const testInstance: TestClass = plainToInstance(TestClass, {
            value: ['Test'],
        });

        expect(testInstance.value).toBeInstanceOf(Array);
        expect(testInstance.value).toEqual(['Test']);
    });
});
