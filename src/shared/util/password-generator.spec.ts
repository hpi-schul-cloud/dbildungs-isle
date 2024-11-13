import { generatePassword } from './password-generator.js';

describe('passwordGenerator', () => {
    it('should return passwords with the correct length', () => {
        for (let i: number = 4; i < 50; i++) {
            expect(generatePassword(i)).toHaveLength(i);
        }
    });

    it('should always return passwords with at least 4 characters', () => {
        for (let i: number = 0; i < 4; i++) {
            expect(generatePassword(i)).toHaveLength(4);
        }
    });

    it.each([
        { name: 'lowercase', regex: /[abcdefghijklmnopqrstuvwxyz]/ },
        { name: 'uppercase', regex: /[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/ },
        { name: 'numbers', regex: /[0123456789]/ },
        { name: 'symbols', regex: /[+\-*/%&!?@$#]/ },
    ])('Should contain $name', ({ regex }: { regex: RegExp }) => {
        // Repeat the test 100 times
        for (let i: number = 0; i < 100; i++) {
            const password: string = generatePassword(4);

            expect(password).toEqual(expect.stringMatching(regex));
        }
    });
});
