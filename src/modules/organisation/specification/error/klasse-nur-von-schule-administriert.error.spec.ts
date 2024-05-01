import { KlasseNurVonSchuleAdministriertError } from './klasse-nur-von-schule-administriert.error.js';

describe('KlasseNurVonSchuleAdministriertSpecificationError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message and code', () => {
                const error: KlasseNurVonSchuleAdministriertError = new KlasseNurVonSchuleAdministriertError('1', {});
                expect(error.message).toBe(
                    'Organisation with ID 1 could not be updated because it violates Klasse-nur-von-Schule-administriert specification',
                );
                expect(error.code).toBe('ENTITY_COULD_NOT_BE_UPDATED');
            });
        });
    });
});
