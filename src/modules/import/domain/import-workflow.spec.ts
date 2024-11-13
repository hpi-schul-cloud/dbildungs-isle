import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { ImportDataRepository } from '../persistence/import-data.repository.js';
import { ImportUploadResultFields, ImportWorkflow } from './import-workflow.js';
import {
    PersonenkontextCreationService,
    PersonPersonenkontext,
} from '../../personenkontext/domain/personenkontext-creation.service.js';
import { ImportWorkflowFactory } from './import-workflow.factory.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { faker } from '@faker-js/faker';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import Papa from 'papaparse';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import internal from 'stream';
import { ImportDataItem } from './import-data-item.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { ImportTextFileCreationError } from './import-text-file-creation.error.js';
import { RolleNurAnPassendeOrganisationError } from '../../personenkontext/specification/error/rolle-nur-an-passende-organisation.js';
import { Person } from '../../person/domain/person.js';
import { ImportCSVFileEmptyError } from './import-csv-file-empty.error.js';
import { ImportNurLernAnSchuleUndKlasseError } from './import-nur-lern-an-schule-und-klasse.error.js';
import { ImportCSVFileParsingError } from './import-csv-file-parsing.error.js';

describe('ImportWorkflow', () => {
    let module: TestingModule;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let organisationRepoMock: DeepMocked<OrganisationRepository>;
    let importDataRepositoryMock: DeepMocked<ImportDataRepository>;
    let personenkontextCreationServiceMock: DeepMocked<PersonenkontextCreationService>;
    let sut: ImportWorkflow;
    let importWorkflowFactory: ImportWorkflowFactory;
    let personpermissionsMock: DeepMocked<PersonPermissions>;

    const SELECTED_ORGANISATION_ID: string = faker.string.uuid();
    const SELECTED_ROLLE_ID: string = faker.string.uuid();
    const FILE_MOCK: Express.Multer.File = createMock<Express.Multer.File>();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                ImportWorkflowFactory,
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: ImportDataRepository,
                    useValue: createMock<ImportDataRepository>(),
                },
                {
                    provide: PersonenkontextCreationService,
                    useValue: createMock<PersonenkontextCreationService>(),
                },
                {
                    provide: PersonPermissions,
                    useValue: createMock<PersonPermissions>(),
                },
            ],
        }).compile();
        rolleRepoMock = module.get(RolleRepo);
        organisationRepoMock = module.get(OrganisationRepository);
        importDataRepositoryMock = module.get(ImportDataRepository);
        personenkontextCreationServiceMock = module.get(PersonenkontextCreationService);
        importWorkflowFactory = module.get(ImportWorkflowFactory);
        sut = importWorkflowFactory.createNew();
        personpermissionsMock = module.get(PersonPermissions);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('initialize', () => {
        it('should initialize the aggregate with the selected Organisation and Rolle', () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            expect(sut.selectedOrganisationId).toBe(SELECTED_ORGANISATION_ID);
            expect(sut.selectedRolleId).toBe(SELECTED_ROLLE_ID);
        });
    });

    describe('validateImport', () => {
        it('should return EntityNotFoundError if the organisation does not exist', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(undefined);
            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return EntityNotFoundError if the rolle does not exist', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            rolleRepoMock.findById.mockResolvedValueOnce(undefined);
            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(EntityNotFoundError);
            expect(organisationRepoMock.findById).toHaveBeenCalledWith(SELECTED_ORGANISATION_ID);
        });

        it('should return EntityNotFoundError if the rolle can not be assigned to organisation', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LERN;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(false);
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(EntityNotFoundError);
            expect(rolleRepoMock.findById).toHaveBeenCalledWith(SELECTED_ROLLE_ID);
        });

        it('should return ImportNurLernAnSchuleUndKlasseError if the rolle is not rollenart LERN', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LEHR;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(ImportNurLernAnSchuleUndKlasseError);
            expect(organisationRepoMock.findById).toHaveBeenCalledWith(SELECTED_ORGANISATION_ID);
            expect(rolleRepoMock.findById).toHaveBeenCalledWith(SELECTED_ROLLE_ID);
        });

        it('should return RolleNurAnPassendeOrganisationError if the rolle does not pass to organisation', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.LAND }),
            );
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LERN;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(RolleNurAnPassendeOrganisationError);
            expect(organisationRepoMock.findById).toHaveBeenCalledWith(SELECTED_ORGANISATION_ID);
            expect(rolleRepoMock.findById).toHaveBeenCalledWith(SELECTED_ROLLE_ID);
        });

        it('should return MissingPermissionsError if the admin does not permissions to import data', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            organisationRepoMock.findById.mockResolvedValueOnce(
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.SCHULE }),
            );
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LERN;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);

            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);

            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(MissingPermissionsError);
        });

        it('should return ImportCSVFileEmptyError if the csv file is empty', async () => {
            const file: Express.Multer.File = createMock<Express.Multer.File>();
            file.buffer = Buffer.from('');

            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LERN;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.SCHULE }),
            );
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);

            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);

            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                file,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(ImportCSVFileEmptyError);
            expect(importDataRepositoryMock.save).not.toHaveBeenCalled();
        });

        it('should return ImportCSVFileParsingError if the parser cannot parse', async () => {
            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.LERN;
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.SCHULE }),
            );
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);

            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            const spyParse: jest.SpyInstance<
                internal.Duplex,
                [stream: typeof Papa.NODE_STREAM_INPUT, config?: Papa.ParseConfig<unknown, undefined> | undefined],
                unknown
            > = jest.spyOn(Papa, 'parse');
            spyParse.mockImplementationOnce(() => {
                throw new Error('Error details');
            });

            const result: DomainError | ImportUploadResultFields = await sut.validateImport(
                FILE_MOCK,
                personpermissionsMock,
            );
            expect(result).toBeInstanceOf(ImportCSVFileParsingError);
            expect(spyParse).toHaveBeenCalled();
        });
    });

    describe('executeImport', () => {
        it('should return MissingPermissionsError if the admin does not have permissions to execute the import transaction', async () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(false);

            const result: Result<Buffer> = await sut.executeImport(faker.string.uuid(), personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new MissingPermissionsError('Unauthorized to import data'),
            });
        });

        it('should return EntityNotFoundError if the import transaction does not exist', async () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.KLASSE }),
            ]);
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[], 0]);
            const importvorgangId: string = faker.string.uuid();

            const result: Result<Buffer> = await sut.executeImport(importvorgangId, personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new EntityNotFoundError('ImportDataItem', importvorgangId),
            });
        });

        it('should return EntityNotFoundError if a klasse during the import execution was deleted', async () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([
                DoFactory.createOrganisation(true, { typ: OrganisationsTyp.KLASSE, name: '1A' }),
            ]);

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = DoFactory.createImportDataItem(true, {
                importvorgangId,
                klasse: '1B',
            });
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[importDataItem], 1]);

            const error: DomainError = new EntityNotFoundError('Organisation', importDataItem.klasse, [
                `Klasse=${importDataItem.klasse} for ${importDataItem.vorname} ${importDataItem.nachname} was not found`,
            ]);

            await expect(sut.executeImport(importvorgangId, personpermissionsMock)).rejects.toThrowError(error);
            expect(personenkontextCreationServiceMock.createPersonWithPersonenkontexte).not.toHaveBeenCalled();
        });

        it('should return the file buffer if the import transaction was executed successfully', async () => {
            const schule: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            const klasse: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '1A',
            });
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([klasse]);

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = DoFactory.createImportDataItem(true, {
                importvorgangId,
                klasse: '1A',
            });

            const person: Person<true> = DoFactory.createPerson(true);
            const pks: PersonPersonenkontext = {
                person: person,
                personenkontexte: [
                    DoFactory.createPersonenkontext(true, { organisationId: schule.id }),
                    DoFactory.createPersonenkontext(true, { organisationId: klasse.id }),
                ],
            };
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[importDataItem], 1]);
            personenkontextCreationServiceMock.createPersonWithPersonenkontexte.mockResolvedValueOnce(pks);
            organisationRepoMock.findById.mockResolvedValueOnce(schule);

            const rolle: Rolle<true> = DoFactory.createRolle(true);
            rolleRepoMock.findById.mockResolvedValueOnce(rolle);

            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const result: Result<Buffer> = await sut.executeImport(importvorgangId, personpermissionsMock);

            if (!result.ok) {
                throw new Error(result.error.message);
            }
            expect(result.value).toBeInstanceOf(Buffer);

            const resultString: string = result.value.toString('utf8');
            expect(resultString).toContain(schule.name);
            expect(resultString).toContain(rolle.name);
            expect(resultString).toContain(person.vorname);
            expect(resultString).toContain(person.familienname);
            expect(resultString).toContain(klasse.name);
            expect(importDataRepositoryMock.deleteByImportVorgangId).toHaveBeenCalledWith(importvorgangId);
        });

        it('should return EntityNotFoundError if the schule is not found', async () => {
            const schule: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            const klasse: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '1A',
            });
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([klasse]);

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = DoFactory.createImportDataItem(true, {
                importvorgangId,
                klasse: '1A',
            });
            const pks: PersonPersonenkontext = {
                person: DoFactory.createPerson(true),
                personenkontexte: [
                    DoFactory.createPersonenkontext(true, { organisationId: schule.id }),
                    DoFactory.createPersonenkontext(true, { organisationId: klasse.id }),
                ],
            };
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[importDataItem], 1]);
            personenkontextCreationServiceMock.createPersonWithPersonenkontexte.mockResolvedValueOnce(pks);
            organisationRepoMock.findById.mockResolvedValueOnce(undefined);

            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const result: Result<Buffer> = await sut.executeImport(importvorgangId, personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new EntityNotFoundError('Organisation', SELECTED_ORGANISATION_ID),
            });
        });

        it('should return EntityNotFoundError if the rolle is not found', async () => {
            const schule: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            const klasse: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '1A',
            });
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([klasse]);

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = DoFactory.createImportDataItem(true, {
                importvorgangId,
                klasse: '1A',
            });
            const pks: PersonPersonenkontext = {
                person: DoFactory.createPerson(true),
                personenkontexte: [
                    DoFactory.createPersonenkontext(true, { organisationId: schule.id }),
                    DoFactory.createPersonenkontext(true, { organisationId: klasse.id }),
                ],
            };
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[importDataItem], 1]);
            personenkontextCreationServiceMock.createPersonWithPersonenkontexte.mockResolvedValueOnce(pks);
            organisationRepoMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            rolleRepoMock.findById.mockResolvedValueOnce(undefined);

            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const result: Result<Buffer> = await sut.executeImport(importvorgangId, personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new EntityNotFoundError('Rolle', SELECTED_ROLLE_ID),
            });
        });

        it('should return ImportTextFileCreationError if the text file cannot be created', async () => {
            const schule: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
            const klasse: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
                name: '1A',
            });
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([klasse]);

            const importvorgangId: string = faker.string.uuid();
            const importDataItem: ImportDataItem<true> = DoFactory.createImportDataItem(true, {
                importvorgangId,
                klasse: '1A',
            });
            const pks: PersonPersonenkontext = {
                person: DoFactory.createPerson(true),
                personenkontexte: [
                    DoFactory.createPersonenkontext(true, { organisationId: schule.id }),
                    DoFactory.createPersonenkontext(true, { organisationId: klasse.id }),
                ],
            };
            importDataRepositoryMock.findByImportVorgangId.mockResolvedValueOnce([[importDataItem], 1]);
            personenkontextCreationServiceMock.createPersonWithPersonenkontexte.mockResolvedValueOnce(pks);
            organisationRepoMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            rolleRepoMock.findById.mockResolvedValueOnce(DoFactory.createRolle(true));
            jest.spyOn(Buffer, 'from').mockImplementationOnce(() => {
                throw new Error('Error details');
            });

            sut.initialize(SELECTED_ORGANISATION_ID, SELECTED_ROLLE_ID);
            const result: Result<Buffer> = await sut.executeImport(importvorgangId, personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new ImportTextFileCreationError([String('Error details')]),
            });
        });
    });

    describe('getFileName', () => {
        it('should return the right file name', () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);
            const importvorgangId: string = faker.string.uuid();
            const expectedFielName: string = importvorgangId + sut.TEXT_FILENAME_NAME;

            const result: string = sut.getFileName(importvorgangId);

            expect(result).toBe(expectedFielName);
        });
    });

    describe('cancelImport', () => {
        it('should return MissingPermissionsError if the admin does not have permissions to cancel the import transaction', async () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(false);

            const result: Result<void> = await sut.cancelImport(faker.string.uuid(), personpermissionsMock);

            expect(result).toEqual({
                ok: false,
                error: new MissingPermissionsError('Unauthorized to import data'),
            });
        });

        it('should call the importDataRepository if the admin has permissions to cancel the import transaction', async () => {
            personpermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValueOnce(true);

            const result: Result<void> = await sut.cancelImport(faker.string.uuid(), personpermissionsMock);
            expect(importDataRepositoryMock.deleteByImportVorgangId).toHaveBeenCalled();
            expect(result).toEqual({ ok: true, value: undefined });
        });
    });
});
