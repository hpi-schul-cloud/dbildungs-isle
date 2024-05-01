import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { MikroORM } from '@mikro-orm/core';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';
import { OrganisationPersistenceMapperProfile } from '../persistence/organisation-persistence.mapper.profile.js';
import { NurKlasseKursUnterSchule } from './nur-klasse-kurs-unter-schule.js';
import { SchuleUnterTraeger } from './schule-unter-traeger.js';
import { TraegerInTraeger } from './traeger-in-traeger.js';
import { ZyklusInOrganisationen } from './zyklus-in-organisationen.js';
import { KlasseNurVonSchuleAdministriert } from './klasse-nur-von-schule-administriert.js';
import { KlassenNameAnSchuleEindeutig } from './klassen-name-an-schule-eindeutig.js';

describe('OrganisationSpecificationTests', () => {
    let module: TestingModule;
    let repo: OrganisationRepo;
    let orm: MikroORM;

    let schule1: OrganisationDo<true>;
    let schule2: OrganisationDo<true>;
    let traeger1: OrganisationDo<true>;
    let traeger2: OrganisationDo<true>;
    let traeger3: OrganisationDo<true>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [OrganisationPersistenceMapperProfile, OrganisationRepo],
        }).compile();
        repo = module.get(OrganisationRepo);
        orm = module.get(MikroORM);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await module.close();
    }, 100000);

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);

        let traeger: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
            id: 'a10852ab-1d75-45a7-9421-b1cbd8abe693',
            name: 'Traeger1',
            typ: OrganisationsTyp.TRAEGER,
            administriertVon: undefined,
            zugehoerigZu: undefined,
        });
        traeger1 = await repo.save(traeger);
        traeger = DoFactory.createOrganisation(false, {
            name: 'Traeger2',
            typ: OrganisationsTyp.TRAEGER,
            administriertVon: traeger1.id,
            zugehoerigZu: traeger1.id,
        });
        traeger2 = await repo.save(traeger);
        traeger = DoFactory.createOrganisation(false, {
            name: 'Traeger3',
            typ: OrganisationsTyp.TRAEGER,
            administriertVon: traeger2.id,
            zugehoerigZu: traeger2.id,
        });
        traeger3 = await repo.save(traeger);
        let schule: OrganisationDo<false> = DoFactory.createOrganisation(false, {
            name: 'Schule1',
            typ: OrganisationsTyp.SCHULE,
            administriertVon: traeger1.id,
            zugehoerigZu: traeger1.id,
        });
        schule1 = await repo.save(schule);
        schule = DoFactory.createOrganisation(false, {
            name: 'Schule2',
            typ: OrganisationsTyp.SCHULE,
            administriertVon: schule1.id,
            zugehoerigZu: schule1.id,
        });
        schule2 = await repo.save(schule);
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('schule-unter-traeger', () => {
        it('should be satisfied when typ is SCHULE and administriertVon and zugehoerigZu is TRAEGER ', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repo);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule1)).toBeTruthy();
        });
        it('should be satisfied when typ is SCHULE and zugehoerigZu is undefined/null', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repo);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: traeger1.id,
                zugehoerigZu: undefined,
            });
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });
        it('should be satisfied when typ is SCHULE and administriertVon is undefined/null', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repo);
            const schule: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                administriertVon: undefined,
                zugehoerigZu: traeger1.id,
            });
            expect(await schuleUnterTraeger.isSatisfiedBy(schule)).toBeFalsy();
        });
        it('should not be satisfied when typ is SCHULE and administriertVon is SCHULE', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repo);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule2)).toBeFalsy();
        });
        it('should not be satisfied when typ is SCHULE and zugehoerigZu is SCHULE', async () => {
            const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(repo);
            expect(await schuleUnterTraeger.isSatisfiedBy(schule2)).toBeFalsy();
        });
    });

    describe('traeger-in-traeger', () => {
        it('should be satisfied when typ is TRAEGER and administriertVon and zugehoerigZu is TRAEGER ', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repo);
            expect(await traegerInTraeger.isSatisfiedBy(traeger2)).toBeTruthy();
        });
        it('should not be satisfied when typ is TRAEGER and administriertVon is not TRAEGER', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repo);
            traeger2.administriertVon = schule1.id;
            expect(await traegerInTraeger.isSatisfiedBy(traeger2)).toBeFalsy();
        });
        it('should not be satisfied when typ is TRAEGER and zugehoerigZu is not TRAEGER', async () => {
            const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(repo);
            traeger2.zugehoerigZu = schule1.id;
            expect(await traegerInTraeger.isSatisfiedBy(traeger2)).toBeFalsy();
        });
    });

    describe('Zyklus-in-organisationen', () => {
        it('should be satisfied, circular reference in two non-root organisations', async () => {
            traeger2.administriertVon = traeger3.id;
            const zyklusInOrganisationen: ZyklusInOrganisationen = new ZyklusInOrganisationen(repo);
            expect(await zyklusInOrganisationen.isSatisfiedBy(traeger2)).toBeTruthy();
        });

        it('should not be satisfied because chaining is not building a circular reference', async () => {
            const zyklusInOrganisationen: ZyklusInOrganisationen = new ZyklusInOrganisationen(repo);
            expect(await zyklusInOrganisationen.isSatisfiedBy(traeger3)).toBeFalsy();
        });

        //this case shall not happen, because in running app altering the root-organisation should be forbidden
        it('should be satisfied, circular reference between non-root and root organisation', async () => {
            let traeger: OrganisationDo<boolean> = DoFactory.createOrganisation(true, {
                id: 'a10852ab-1d75-45a7-9421-b1cbd8abe693',
                name: 'Traeger1',
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: undefined,
            });
            const t1: OrganisationDo<true> = await repo.save(traeger);
            traeger = DoFactory.createOrganisation(false, {
                name: 'Traeger2',
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: t1.id,
            });
            const t2: OrganisationDo<true> = await repo.save(traeger);
            traeger = DoFactory.createOrganisation(false, {
                name: 'Traeger3',
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: t2.id,
            });
            const t3: OrganisationDo<true> = await repo.save(traeger);

            t1.administriertVon = t3.id;
            const zyklusInOrganisationen: ZyklusInOrganisationen = new ZyklusInOrganisationen(repo);
            expect(await zyklusInOrganisationen.isSatisfiedBy(t1)).toBeTruthy();
        });
    });

    describe('nur-klasse-kurs-unter-schule', () => {
        it('should be satisfied when typ is undefined and parent has typ SCHULE', async () => {
            const klasseDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                name: 'Klasse1',
                typ: undefined,
                administriertVon: schule1.id,
                zugehoerigZu: schule1.id,
            });
            const klasse: OrganisationDo<true> = await repo.save(klasseDo);
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repo);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(klasse)).toBeTruthy();
        });
        it('should not be satisfied when typ is TRAEGER and parent via administriertVon has typ SCHULE', async () => {
            const traegerDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                name: 'EinTraeger',
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: schule1.id,
                zugehoerigZu: undefined,
            });
            const einTraeger: OrganisationDo<true> = await repo.save(traegerDo);
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repo);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(einTraeger)).toBeFalsy();
        });
        it('should not be satisfied when typ is TRAEGER and parent via zugehoerigZu has typ SCHULE', async () => {
            const traegerDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                name: 'EinTraeger',
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: undefined,
                zugehoerigZu: schule1.id,
            });
            const einTraeger: OrganisationDo<true> = await repo.save(traegerDo);
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repo);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(einTraeger)).toBeFalsy();
        });
        it('should be satisfied when typ not Klasse/Kurs and administriertVon is undefined/null', async () => {
            const traeger: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.TRAEGER,
                administriertVon: undefined,
                zugehoerigZu: undefined,
            });
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repo);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(traeger)).toBeTruthy();
        });
        it('should be satisfied when zugehoerigZu is undefined/null', async () => {
            const sonstige: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SONSTIGE,
                administriertVon: undefined,
                zugehoerigZu: undefined,
            });
            const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(repo);
            expect(await nurKlasseKursUnterSchule.isSatisfiedBy(sonstige)).toBeTruthy();
        });
    });

    describe('klasse-nur-von-schule-administriert', () => {
        it('should be satisfied when typ is not KLASSE', async () => {
            const keineKlasseDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                name: 'KeineKlasse',
                typ: undefined,
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
            });
            const keineKlasse: OrganisationDo<true> = await repo.save(keineKlasseDo);
            const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert =
                new KlasseNurVonSchuleAdministriert(repo);
            expect(await klasseNurVonSchuleAdministriert.isSatisfiedBy(keineKlasse)).toBeTruthy();
        });
        it('should NOT be satisfied when typ is KLASSE and administriertVon is undefined/null', async () => {
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: undefined,
                zugehoerigZu: schule1.id,
            });
            const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert =
                new KlasseNurVonSchuleAdministriert(repo);
            expect(await klasseNurVonSchuleAdministriert.isSatisfiedBy(klasse)).toBeFalsy();
        });
        it('should NOT be satisfied when typ is KLASSE and zugehoerigZu is undefined/null', async () => {
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: schule1.id,
                zugehoerigZu: undefined,
            });
            const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert =
                new KlasseNurVonSchuleAdministriert(repo);
            expect(await klasseNurVonSchuleAdministriert.isSatisfiedBy(klasse)).toBeFalsy();
        });
    });

    describe('klassen-name-an-schule-eindeutig', () => {
        it('should be satisfied when typ is not KLASSE', async () => {
            const keineKlasseDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                name: 'KeineKlasse',
                typ: undefined,
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
            });
            const keineKlasse: OrganisationDo<true> = await repo.save(keineKlasseDo);
            const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(repo);
            expect(await klassenNameAnSchuleEindeutig.isSatisfiedBy(keineKlasse)).toBeTruthy();
        });
        it('should NOT be satisfied when typ is KLASSE and administriertVon is undefined/null', async () => {
            const klasse: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                administriertVon: undefined,
                zugehoerigZu: schule1.id,
            });
            const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(repo);
            expect(await klassenNameAnSchuleEindeutig.isSatisfiedBy(klasse)).toBeFalsy();
        });
    });
});
