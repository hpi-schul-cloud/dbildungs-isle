import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, DatabaseTestModule, DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { OrganisationPersistenceMapperProfile } from '../persistence/organisation-persistence.mapper.profile.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';
import { NurKlasseKursUnterSchule } from './nur-klasse-kurs-unter-schule.js';
import { SchuleUnterTraeger } from './schule-unter-traeger.js';
import { TraegerInTraeger } from './traeger-in-traeger.js';
import { KlasseNurVonSchuleAdministriert } from './klasse-nur-von-schule-administriert.js';
import { KlassenNameAnSchuleEindeutig } from './klassen-name-an-schule-eindeutig.js';

describe('OrganisationSpecificationMockedRepoTest', () => {
    let module: TestingModule;
    let organisationRepoMock: DeepMocked<OrganisationRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: false }), MapperTestModule],
            providers: [
                OrganisationPersistenceMapperProfile,
                {
                    provide: OrganisationRepo,
                    useValue: createMock<OrganisationRepo>(),
                },
            ],
        }).compile();
        organisationRepoMock = module.get(OrganisationRepo);
    }, 100000);

    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('schule-unter-traeger', () => {
        it('should be satisfied when organisation is not SCHULE', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(organisationRepoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SONSTIGE,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeTruthy();
        });

        it('should not be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(organisationRepoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });

        it('should not be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(organisationRepoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(traeger); //mock call to administriertVon
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });
    });

    describe('traeger-in-traeger', () => {
        it('should be satisfied when organisation is not TRAEGER', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(organisationRepoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SONSTIGE,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeTruthy();
        });
        it('should not be satisfied when administriertVon is undefined', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(organisationRepoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: undefined,
            });
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when zugehoerigZu is undefined', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(organisationRepoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: undefined,
            });
            const andererTraeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(andererTraeger);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(organisationRepoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(organisationRepoMock);
            const andererTraeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(andererTraeger);
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
    });

    describe('nur-klasse-kurs-unter-schule', () => {
        it('should be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(
                organisationRepoMock,
            );
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: undefined,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to zugehoerigZu
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(klasse)).toBeTruthy();
        });
        it('should be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(
                organisationRepoMock,
            );
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: undefined,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to administriertVon
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(klasse)).toBeTruthy();
        });
    });

    describe('klasse-nur-von-schule-administriert', () => {
        it('should NOT be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert =
                new KlasseNurVonSchuleAdministriert(organisationRepoMock);
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to zugehoerigZu
            expect(await klasseNurVonSchuleAdministriert.isSatisfiedBy(klasse)).toBeFalsy();
        });
        it('should NOT be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert =
                new KlasseNurVonSchuleAdministriert(organisationRepoMock);
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to administriertVon
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await klasseNurVonSchuleAdministriert.isSatisfiedBy(klasse)).toBeFalsy();
        });
    });

    describe('klassen-name-an-schule-eindeutig', () => {
        it('should NOT be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(
                organisationRepoMock,
            );
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: '1',
            });
            organisationRepoMock.findById.mockResolvedValueOnce(null);
            expect(await klassenNameAnSchuleEindeutig.isSatisfiedBy(klasse)).toBeFalsy();
        });

        it('should NOT be satisfied when Klasse with same name already exists on same Schule', async () => {
            const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(
                organisationRepoMock,
            );
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '9a',
                administriertVon: '1',
            });

            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            const andereKlasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '9a',
                administriertVon: schule.id,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to find schule as parent
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([andereKlasse]);
            expect(await klassenNameAnSchuleEindeutig.isSatisfiedBy(klasse)).toBeFalsy();
        });

        it('should be satisfied when other Klassen on Schule exist, but have different names', async () => {
            const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(
                organisationRepoMock,
            );
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '10b',
                administriertVon: '1',
            });

            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            const andereKlasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '9a',
                administriertVon: schule.id,
            });
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock call to find schule as parent
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([andereKlasse]);
            expect(await klassenNameAnSchuleEindeutig.isSatisfiedBy(klasse)).toBeTruthy();
        });
    });
});
