import { PersonalNummerForPersonWithTrailingSpaceError } from './personalnummer-with-trailing-space.error.js';

describe('PersonalNummerForPersonWithTrailingSpaceError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message and code', () => {
                const error: PersonalNummerForPersonWithTrailingSpaceError =
                    new PersonalNummerForPersonWithTrailingSpaceError({});
                expect(error.message).toBe(
                    'Person could not be created/updated because Personalnummer contains trailing space',
                );
                expect(error.code).toBe('ENTITY_COULD_NOT_BE_UPDATED');
            });
        });
    });
});
