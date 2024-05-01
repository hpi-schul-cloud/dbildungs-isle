import { KlassenNameAnSchuleEindeutigError } from './klassen-name-an-schule-eindeutig.error.js';

describe('KlassenNameAnSchuleEindeutigSpecificationError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message and code', () => {
                const error: KlassenNameAnSchuleEindeutigError = new KlassenNameAnSchuleEindeutigError('1', {});
                expect(error.message).toBe(
                    'Organisation with ID 1 could not be updated because it violates Klassen-Name-an-Schule-eindeutig specification',
                );
                expect(error.code).toBe('ENTITY_COULD_NOT_BE_UPDATED');
            });
        });
    });
});
