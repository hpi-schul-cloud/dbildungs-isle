import { DoFactory } from '../../../../test/utils/index.js';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';
import { NameRequiredForKlasse } from './name-required-for-klasse.js';

describe('NameRequiredForKlasse specification', () => {
    const specification: NameRequiredForKlasse = new NameRequiredForKlasse();

    describe('when organisation is schule', () => {
        it('should return true, if name is set', async () => {
            const schule: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.KLASSE,
                name: 'test',
            });

            await expect(specification.isSatisfiedBy(schule)).resolves.toBe(true);
        });

        it('should return false, if name is undefined', async () => {
            const schule: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.KLASSE,
                name: undefined,
            });

            await expect(specification.isSatisfiedBy(schule)).resolves.toBe(false);
        });

        it('should return false, if name is empty string', async () => {
            const schule: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.KLASSE,
                name: '',
            });

            await expect(specification.isSatisfiedBy(schule)).resolves.toBe(false);
        });
    });

    describe('when organisation is not klasse', () => {
        it('should return true, if name is set', async () => {
            const organisation: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SONSTIGE,
                name: 'test',
            });

            await expect(specification.isSatisfiedBy(organisation)).resolves.toBe(true);
        });

        it('should return true, if name is undefined', async () => {
            const organisation: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SONSTIGE,
                name: undefined,
            });

            await expect(specification.isSatisfiedBy(organisation)).resolves.toBe(true);
        });

        it('should return true, if name is empty string', async () => {
            const organisation: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SONSTIGE,
                name: '',
            });

            await expect(specification.isSatisfiedBy(organisation)).resolves.toBe(true);
        });
    });
});
