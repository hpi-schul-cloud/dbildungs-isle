import { OrganisationUpdateOutdatedError } from './orga-update-outdated.error.js';

describe('OrganisationUpdateOutdatedError', () => {
    describe('constructor', () => {
        describe('when calling the constructor', () => {
            it('should set message', () => {
                const error: OrganisationUpdateOutdatedError = new OrganisationUpdateOutdatedError({});
                expect(error.message).toBe(
                    'Organisaton could not be updated because newer versions of Organisaton exist.',
                );
            });
        });
    });
});
