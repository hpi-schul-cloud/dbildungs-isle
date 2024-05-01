import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationService } from './organisation.service.js';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { OrganisationDo } from './organisation.do.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { DatabaseTestModule } from '../../../../test/utils/database-test.module.js';
import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { OrganisationsTyp } from './organisation.enums.js';
import { MikroORM } from '@mikro-orm/core';
import { MapperTestModule } from '../../../../test/utils/index.js';
import { OrganisationPersistenceMapperProfile } from '../persistence/organisation-persistence.mapper.profile.js';
import { ZyklusInOrganisationenError } from '../specification/error/zyklus-in-organisationen.error.js';
import { RootOrganisationImmutableError } from '../specification/error/root-organisation-immutable.error.js';
import { NurKlasseKursUnterSchuleError } from '../specification/error/nur-klasse-kurs-unter-schule.error.js';
import { SchuleUnterTraegerError } from '../specification/error/schule-unter-traeger.error.js';
import { TraegerInTraegerError } from '../specification/error/traeger-in-traeger.error.js';

describe('OrganisationServiceSpecificationTest', () => {
    let module: TestingModule;
    let organisationService: OrganisationService;
    let organisationRepo: OrganisationRepo;
    let orm: MikroORM;
    let root: OrganisationDo<true>;
    let traeger1: OrganisationDo<true>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [OrganisationService, OrganisationRepo, OrganisationPersistenceMapperProfile],
        }).compile();
        organisationService = module.get(OrganisationService);
        organisationRepo = module.get(OrganisationRepo);
        orm = module.get(MikroORM);

        await DatabaseTestModule.setupDatabase(orm);
    }, 100000);

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    beforeEach(async () => {
        jest.resetAllMocks();
        await DatabaseTestModule.clearDatabase(orm);
        const rootDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
            name: 'Root',
            administriertVon: undefined,
            zugehoerigZu: undefined,
            typ: OrganisationsTyp.TRAEGER,
        });
        root = await organisationRepo.save(rootDo);
        const traeger1Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
            name: 'Träger1',
            administriertVon: root.id,
            zugehoerigZu: root.id,
            typ: OrganisationsTyp.TRAEGER,
        });
        traeger1 = await organisationRepo.save(traeger1Do);
    });

    it('should be defined', () => {
        expect(organisationService).toBeDefined();
    });

    describe('setAdministriertVon', () => {
        it('should update the organisation', async () => {
            const traeger2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Träger2',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: OrganisationDo<true> = await organisationRepo.save(traeger2Do);
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.administriertVon = root.id;
            schuleDo.zugehoerigZu = root.id;
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(traeger2.id, schule.id);

            expect(result).toEqual<Result<void>>({
                ok: true,
                value: undefined,
            });
        });

        it('should return a domain error if adminstriertVon property of root organisation should be altered', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: undefined,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.administriertVon = root.id;
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, root.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new RootOrganisationImmutableError({}),
            });
        });

        it('should return a domain error if the SchuleUnterTraeger specification is not met', async () => {
            const schule1Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule1: OrganisationDo<true> = await organisationRepo.save(schule1Do);
            const schule2: OrganisationDo<true> = await organisationRepo.save(schule2Do);

            const result: Result<void> = await organisationService.setAdministriertVon(schule1.id, schule2.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new SchuleUnterTraegerError(schule2.id),
            });
        });

        it('should return a domain error if the TraegerInTraeger specification is not met', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new TraegerInTraegerError(traeger1.id),
            });
        });

        it('should return a domain error if the ZyklusInAdministriertVon specification is not met', async () => {
            const traeger2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Traeger2',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: OrganisationDo<true> = await organisationRepo.save(traeger2Do);

            const result: Result<void> = await organisationService.setAdministriertVon(traeger2.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new ZyklusInOrganisationenError(traeger1.id),
            });
        });

        it('should return a domain error if the NurKlasseKursUnterSchule specification is not met', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);
            const sonstigeDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Sonstige1',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SONSTIGE,
            });
            const sonstige: OrganisationDo<true> = await organisationRepo.save(sonstigeDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, sonstige.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new NurKlasseKursUnterSchuleError(sonstige.id),
            });
        });
    });

    describe('setZugehoerigZu', () => {
        it('should update the organisation', async () => {
            const traeger2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Träger2',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: OrganisationDo<true> = await organisationRepo.save(traeger2Do);
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.zugehoerigZu = root.id;
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(traeger2.id, schule.id);

            expect(result).toEqual<Result<void>>({
                ok: true,
                value: undefined,
            });
        });

        it('should return a domain error if zugehoerigZu property of root organisation should be altered', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.zugehoerigZu = root.id;
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, root.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new RootOrganisationImmutableError({}),
            });
        });

        it('should return a domain error if the SchuleUnterTraeger specification is not met', async () => {
            const schule1Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule1: OrganisationDo<true> = await organisationRepo.save(schule1Do);
            const schule2: OrganisationDo<true> = await organisationRepo.save(schule2Do);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule1.id, schule2.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new SchuleUnterTraegerError(schule2.id),
            });
        });

        it('should return a domain error if the TraegerInTraeger specification is not met', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new TraegerInTraegerError(traeger1.id),
            });
        });

        it('should return a domain error if the ZyklusInZugehoerigZu specification is not met', async () => {
            const traeger2Do: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Traeger2',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: OrganisationDo<true> = await organisationRepo.save(traeger2Do);

            const result: Result<void> = await organisationService.setZugehoerigZu(traeger2.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new ZyklusInOrganisationenError(traeger1.id),
            });
        });

        it('should return a domain error if the NurKlasseKursUnterSchule specification is not met', async () => {
            const schuleDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: OrganisationDo<true> = await organisationRepo.save(schuleDo);
            const sonstigeDo: OrganisationDo<boolean> = DoFactory.createOrganisation(false, {
                name: 'Sonstige1',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SONSTIGE,
            });
            const sonstige: OrganisationDo<true> = await organisationRepo.save(sonstigeDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, sonstige.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new NurKlasseKursUnterSchuleError(sonstige.id),
            });
        });
    });
});
