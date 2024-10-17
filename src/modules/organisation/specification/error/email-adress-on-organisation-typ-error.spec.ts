import { EmailAdressOnOrganisationTypError } from './email-adress-on-organisation-typ-error.js';

describe('EmailAdressOnOrganisationTypError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message and code', () => {
                const error: EmailAdressOnOrganisationTypError = new EmailAdressOnOrganisationTypError({});
                expect(error.message).toBe(
                    'Organisation Entity Could not be created/updated because this organisation typ can not have an email adress',
                );
                expect(error.code).toBe('ENTITY_COULD_NOT_BE_UPDATED');
            });
        });
    });
});
