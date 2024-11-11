import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { MapperTestModule } from '../../../../test/utils/mapper-test.module.js';
import { Organisation } from './organisation.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { OrganisationsTyp } from './organisation.enums.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { KlassenNameAnSchuleEindeutigError } from '../specification/error/klassen-name-an-schule-eindeutig.error.js';
import { NameRequiredForKlasseError } from '../specification/error/name-required-for-klasse.error.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DomainError } from '../../../shared/error/domain.error.js';
import { NameForOrganisationWithTrailingSpaceError } from '../specification/error/name-with-trailing-space.error.js';
import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';

describe('Organisation', () => {
    let module: TestingModule;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, MapperTestModule],
            providers: [
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
            ],
        }).compile();
        organisationRepositoryMock = module.get(OrganisationRepository);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('construct', () => {
        it('should return persisted organisation', () => {
            const organisation: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );

            expect(organisation).toBeDefined();
            expect(organisation).toBeInstanceOf(Organisation<true>);
        });
    });

    describe('createNew', () => {
        it('should return non pesisted organisation', () => {
            const organisation: Organisation<false> | DomainError = Organisation.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );

            expect(organisation).toBeDefined();
            expect(organisation).toBeInstanceOf(Organisation<false>);
        });
        it('should return non persisted organisation', () => {
            const organisation: Organisation<false> | DomainError = Organisation.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                'kennung',
                'name',
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );

            expect(organisation).toBeDefined();
            expect(organisation).toBeInstanceOf(Organisation<false>);
        });

        it('should return an error if name has leading whitespace', () => {
            const result: DomainError | Organisation<false> = Organisation.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                'kennung',
                ' Test',
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );
            expect(result).toBeInstanceOf(NameForOrganisationWithTrailingSpaceError);
        });

        it('should return an error if dienststellennummer has leading whitespace', () => {
            const result: DomainError | Organisation<false> = Organisation.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                ' Test',
                'name',
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );
            expect(result).toBeInstanceOf(KennungForOrganisationWithTrailingSpaceError);
        });
    });

    describe('checkKlasseSpecifications', () => {
        describe('if KlassenNameAnSchuleEindeutig is not valid', () => {
            it('should return KlassenNameAnSchuleEindeutigError', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: faker.string.uuid(),
                });
                const otherOrga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: faker.string.uuid(),
                });
                const parentOrga: Organisation<boolean> = DoFactory.createOrganisationAggregate(true, {
                    typ: OrganisationsTyp.SCHULE,
                });
                organisationRepositoryMock.findById.mockResolvedValueOnce(parentOrga);
                organisationRepositoryMock.findChildOrgasForIds.mockResolvedValueOnce([otherOrga]);

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(KlassenNameAnSchuleEindeutigError);
            });
        });

        describe('if Organisation is not a Klasse', () => {
            it('should return validated', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    typ: OrganisationsTyp.SCHULE,
                    administriertVon: faker.string.uuid(),
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeUndefined();
            });
        });

        describe('if Organisation has no Parent', () => {
            it('should return KlassenNameAnSchuleEindeutigError', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: undefined,
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(KlassenNameAnSchuleEindeutigError);
            });
        });

        describe('if parent of Organisation cannot be found', () => {
            it('should return KlassenNameAnSchuleEindeutigError', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: faker.string.uuid(),
                });
                organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);
                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(KlassenNameAnSchuleEindeutigError);
            });
        });

        describe('if Organisation has no ID', () => {
            it('should return KlassenNameAnSchuleEindeutigError with id=undefined', async () => {
                const orga: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    name: 'name',
                    typ: OrganisationsTyp.KLASSE,
                    administriertVon: undefined,
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(KlassenNameAnSchuleEindeutigError);
            });
        });

        describe('if NameRequiredForKlasse is not valid', () => {
            it('should return NameRequiredForKlasseError', async () => {
                const orga: Organisation<boolean> = DoFactory.createOrganisationAggregate(false, {
                    name: '',
                    typ: OrganisationsTyp.KLASSE,
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(NameRequiredForKlasseError);
            });
        });

        describe('if name of updated organisation has trailing whitespace', () => {
            it('should return NameForOrganisationWithTrailingSpaceError', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: ' name',
                    typ: OrganisationsTyp.KLASSE,
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(NameForOrganisationWithTrailingSpaceError);
            });
        });

        describe('if kennung of updated organisation has trailing whitespace', () => {
            it('should return KennungForOrganisationWithTrailingSpaceError', async () => {
                const orga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    name: 'name',
                    kennung: 'kennung ',
                    typ: OrganisationsTyp.KLASSE,
                });

                const updateError: OrganisationSpecificationError | undefined =
                    await orga.checkKlasseSpecifications(organisationRepositoryMock);

                expect(updateError).toBeInstanceOf(KennungForOrganisationWithTrailingSpaceError);
            });
        });
    });
});
