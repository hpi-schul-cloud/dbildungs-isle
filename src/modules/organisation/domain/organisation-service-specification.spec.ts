import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationService } from './organisation.service.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { DatabaseTestModule } from '../../../../test/utils/database-test.module.js';
import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { MikroORM } from '@mikro-orm/core';
import { LoggingTestModule, MapperTestModule } from '../../../../test/utils/index.js';
import { OrganisationPersistenceMapperProfile } from '../persistence/organisation-persistence.mapper.profile.js';
import { ZyklusInOrganisationenError } from '../specification/error/zyklus-in-organisationen.error.js';
import { RootOrganisationImmutableError } from '../specification/error/root-organisation-immutable.error.js';
import { NurKlasseKursUnterSchuleError } from '../specification/error/nur-klasse-kurs-unter-schule.error.js';
import { SchuleUnterTraegerError } from '../specification/error/schule-unter-traeger.error.js';
import { TraegerInTraegerError } from '../specification/error/traeger-in-traeger.error.js';
import { KlasseNurVonSchuleAdministriertError } from '../specification/error/klasse-nur-von-schule-administriert.error.js';
import { KlassenNameAnSchuleEindeutigError } from '../specification/error/klassen-name-an-schule-eindeutig.error.js';
import { DomainError } from '../../../shared/error/index.js';
import { EventModule } from '../../../core/eventbus/index.js';
import { Organisation } from './organisation.js';
import { OrganisationsTyp } from './organisation.enums.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';

describe('OrganisationServiceSpecificationTest', () => {
    let module: TestingModule;
    let organisationService: OrganisationService;
    let organisationRepository: OrganisationRepository;
    let orm: MikroORM;
    let root: Organisation<true>;
    let traeger1: Organisation<true>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                LoggingTestModule,
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                MapperTestModule,
                EventModule,
            ],
            providers: [OrganisationService, OrganisationRepository, OrganisationPersistenceMapperProfile],
        }).compile();
        organisationService = module.get(OrganisationService);
        organisationRepository = module.get(OrganisationRepository);
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
        const rootDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
            name: 'Root',
            administriertVon: undefined,
            zugehoerigZu: undefined,
            typ: OrganisationsTyp.TRAEGER,
        });
        root = await organisationRepository.save(rootDo);
        const traeger1Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
            name: 'Träger1',
            administriertVon: root.id,
            zugehoerigZu: root.id,
            typ: OrganisationsTyp.TRAEGER,
        });
        traeger1 = await organisationRepository.save(traeger1Do);
    });

    it('should be defined', () => {
        expect(organisationService).toBeDefined();
    });

    describe('create', () => {
        it('should return DomainError, when KlasseNurVonSchuleAdministriert specificaton is not satisfied and type is KLASSE', async () => {
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.KLASSE,
            });

            const result: Result<Organisation<true>, DomainError> = await organisationService.createOrganisation(
                klasseDo,
            );

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KlasseNurVonSchuleAdministriertError(undefined),
            });
        });

        it('should return a DomainError when KlassenNameAnSchuleEindeutig specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            await organisationRepository.save(klasseDo);
            const weitereKlasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(weitereKlasseDo);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KlassenNameAnSchuleEindeutigError(undefined),
            });
        });
    });
    describe('update', () => {
        it('should return DomainError, when klasse specifications are not satisfied and type is klasse', async () => {
            const klasse: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'klasse',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const klassePersisted: Organisation<true> = await organisationRepository.save(klasse);

            const result: Result<Organisation<true>, DomainError> = await organisationService.updateOrganisation(
                klassePersisted,
            );

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KlasseNurVonSchuleAdministriertError(klassePersisted.id),
            });
        });
    });

    describe('setAdministriertVon', () => {
        it('should update the organisation', async () => {
            const traeger2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Träger2',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: Organisation<true> = await organisationRepository.save(traeger2Do);
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.administriertVon = root.id;
            schuleDo.zugehoerigZu = root.id;
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(traeger2.id, schule.id);

            expect(result).toEqual<Result<void>>({
                ok: true,
                value: undefined,
            });
        });

        it('should return a domain error if adminstriertVon property of root organisation should be altered', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: undefined,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.administriertVon = root.id;
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, root.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new RootOrganisationImmutableError({}),
            });
        });

        it('should return a domain error if the SchuleUnterTraeger specification is not met', async () => {
            const schule1Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule1: Organisation<true> = await organisationRepository.save(schule1Do);
            const schule2: Organisation<true> = await organisationRepository.save(schule2Do);

            const result: Result<void> = await organisationService.setAdministriertVon(schule1.id, schule2.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new SchuleUnterTraegerError(schule2.id),
            });
        });

        it('should return a domain error if the TraegerInTraeger specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new TraegerInTraegerError(traeger1.id),
            });
        });

        it('should return a domain error if the ZyklusInAdministriertVon specification is not met', async () => {
            const traeger2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Traeger2',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: Organisation<true> = await organisationRepository.save(traeger2Do);

            const result: Result<void> = await organisationService.setAdministriertVon(traeger2.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new ZyklusInOrganisationenError(traeger1.id),
            });
        });

        it('should return a domain error if the NurKlasseKursUnterSchule specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const sonstigeDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Sonstige1',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SONSTIGE,
            });
            const sonstige: Organisation<true> = await organisationRepository.save(sonstigeDo);

            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, sonstige.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new NurKlasseKursUnterSchuleError(sonstige.id),
            });
        });

        it('should return a domain error if the KlasseNurVonSchuleAdministriert specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const klasse: Organisation<true> = await organisationRepository.save(klasseDo);

            const result: Result<void> = await organisationService.setAdministriertVon(traeger1.id, klasse.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new KlasseNurVonSchuleAdministriertError(klasse.id),
            });
        });

        it('should return a domain error if the KlassenNameAnSchuleEindeutig specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            await organisationRepository.save(klasseDo);
            const weitereKlasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const weitereKlasse: Organisation<true> = await organisationRepository.save(weitereKlasseDo);
            const result: Result<void> = await organisationService.setAdministriertVon(schule.id, weitereKlasse.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new KlassenNameAnSchuleEindeutigError(weitereKlasse.id),
            });
        });
    });

    describe('setZugehoerigZu', () => {
        it('should update the organisation', async () => {
            const traeger2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Träger2',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: Organisation<true> = await organisationRepository.save(traeger2Do);
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.zugehoerigZu = root.id;
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(traeger2.id, schule.id);

            expect(result).toEqual<Result<void>>({
                ok: true,
                value: undefined,
            });
        });

        it('should return a domain error if zugehoerigZu property of root organisation should be altered', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.SCHULE,
            });
            schuleDo.zugehoerigZu = root.id;
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, root.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new RootOrganisationImmutableError({}),
            });
        });

        it('should return a domain error if the SchuleUnterTraeger specification is not met', async () => {
            const schule1Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule1: Organisation<true> = await organisationRepository.save(schule1Do);
            const schule2: Organisation<true> = await organisationRepository.save(schule2Do);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule1.id, schule2.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new SchuleUnterTraegerError(schule2.id),
            });
        });

        it('should return a domain error if the TraegerInTraeger specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: root.id,
                zugehoerigZu: root.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new TraegerInTraegerError(traeger1.id),
            });
        });

        it('should return a domain error if the ZyklusInZugehoerigZu specification is not met', async () => {
            const traeger2Do: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Traeger2',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traeger2: Organisation<true> = await organisationRepository.save(traeger2Do);

            const result: Result<void> = await organisationService.setZugehoerigZu(traeger2.id, traeger1.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new ZyklusInOrganisationenError(traeger1.id),
            });
        });

        it('should return a domain error if the NurKlasseKursUnterSchule specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const sonstigeDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Sonstige1',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SONSTIGE,
            });
            const sonstige: Organisation<true> = await organisationRepository.save(sonstigeDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, sonstige.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new NurKlasseKursUnterSchuleError(sonstige.id),
            });
        });

        it('should return a domain error if the KlasseNurVonSchuleAdministriert specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const klasse: Organisation<true> = await organisationRepository.save(klasseDo);

            const result: Result<void> = await organisationService.setZugehoerigZu(traeger1.id, klasse.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new KlasseNurVonSchuleAdministriertError(klasse.id),
            });
        });

        it('should return a domain error if the KlassenNameAnSchuleEindeutig specification is not met', async () => {
            const schuleDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Schule',
                administriertVon: traeger1.id,
                zugehoerigZu: traeger1.id,
                typ: OrganisationsTyp.SCHULE,
            });
            const schule: Organisation<true> = await organisationRepository.save(schuleDo);
            const klasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            await organisationRepository.save(klasseDo);
            const weitereKlasseDo: Organisation<boolean> = DoFactory.createOrganisation(false, {
                name: 'Klasse',
                administriertVon: schule.id,
                zugehoerigZu: schule.id,
                typ: OrganisationsTyp.KLASSE,
            });
            const weitereKlasse: Organisation<true> = await organisationRepository.save(weitereKlasseDo);
            const result: Result<void> = await organisationService.setZugehoerigZu(schule.id, weitereKlasse.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new KlassenNameAnSchuleEindeutigError(weitereKlasse.id),
            });
        });
    });
});
