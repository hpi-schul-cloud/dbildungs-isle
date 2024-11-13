import { randomInt } from 'node:crypto';

const LOWERCASE: string = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE: string = LOWERCASE.toUpperCase();
const NUMBERS: string = '0123456789';
const SYMBOLS: string = '+-*/%&!?@$#';
const ALL_CHARACTERS: string = LOWERCASE + UPPERCASE + NUMBERS + SYMBOLS;

function randomChar(str: string): string {
    return str.charAt(randomInt(str.length));
}

/**
 * Generates a random password with the following rules:
 * - At least one lowercase character
 * - At least one uppercase character
 * - At least one number
 * - At least one symbol
 *
 * Passwords will always be at least 4 characters long, to fulfill these rules
 * @param length The length of the password
 */
export function generatePassword(length: number = 8): string {
    let password: string = '';
    password += randomChar(LOWERCASE); // One lowercase char
    password += randomChar(UPPERCASE); // One uppercase char
    password += randomChar(NUMBERS); // One number
    password += randomChar(SYMBOLS); // One symbol

    for (let i: number = password.length; i < length; i++) {
        password += randomChar(ALL_CHARACTERS); // Fill the rest with random characters
    }

    return password;
}
