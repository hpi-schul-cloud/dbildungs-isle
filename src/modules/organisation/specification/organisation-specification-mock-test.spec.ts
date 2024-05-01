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

describe('OrganisationSpecificationMockedRepoTest', () => {
    let module: TestingModule;
    let repoMock: DeepMocked<OrganisationRepo>;

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
        repoMock = module.get(OrganisationRepo);
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
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SONSTIGE,
                administriertVon: '1',
            });
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeTruthy();
        });

        it('should not be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: '1',
            });
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });

        it('should not be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repoMock);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
            });
            repoMock.findById.mockResolvedValueOnce(traeger); //mock call to administriertVon
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });
    });

    describe('traeger-in-traeger', () => {
        it('should be satisfied when organisation is not TRAEGER', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SONSTIGE,
                administriertVon: '1',
            });
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeTruthy();
        });
        it('should not be satisfied when administriertVon is undefined', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: undefined,
            });
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when zugehoerigZu is undefined', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repoMock);
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
            repoMock.findById.mockResolvedValueOnce(andererTraeger);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repoMock);
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
        it('should not be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repoMock);
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
            repoMock.findById.mockResolvedValueOnce(andererTraeger);
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await traegerInTraeger.isSatisfiedBy(traeger)).toBeFalsy();
        });
    });

    describe('nur-klasse-kurs-unter-schule', () => {
        it('should be satisfied when organisation referenced by administriertVon cannot be found', async () => {
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repoMock);
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: undefined,
                administriertVon: '1',
            });
            repoMock.findById.mockResolvedValueOnce(null);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            repoMock.findById.mockResolvedValueOnce(schule); //mock call to zugehoerigZu
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(klasse)).toBeTruthy();
        });
        it('should be satisfied when organisation referenced by zugehoerigZu cannot be found', async () => {
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repoMock);
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: undefined,
                administriertVon: '1',
                zugehoerigZu: '1',
            });
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            repoMock.findById.mockResolvedValueOnce(schule); //mock call to administriertVon
            repoMock.findById.mockResolvedValueOnce(null);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(klasse)).toBeTruthy();
        });
    });
});
