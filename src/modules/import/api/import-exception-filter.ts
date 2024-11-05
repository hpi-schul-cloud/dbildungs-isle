import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import { ImportDomainError } from '../domain/import-domain.error.js';
import { DbiamImportError, ImportErrorI18nTypes } from './dbiam-import.error.js';
import { ImportCSVFileParsingError } from '../domain/import-csv-file-parsing.error.js';
import { ImportTextFileCreationError } from '../domain/import-text-file-creation.error.js';
import { ImportCSVFileEmptyError } from '../domain/import-csv-file-empty.error.js';
import { ImportNurLernAnSchuleUndKlasseError } from '../domain/import-nur-lern-an-schule-und-klasse.error.js';

@Catch(ImportDomainError)
export class ImportExceptionFilter implements ExceptionFilter<ImportDomainError> {
    private ERROR_MAPPINGS: Map<string, DbiamImportError> = new Map([
        [
            ImportCSVFileParsingError.name,
            new DbiamImportError({
                code: 400,
                i18nKey: ImportErrorI18nTypes.CSV_PARSING_ERROR,
            }),
        ],
        [
            ImportCSVFileEmptyError.name,
            new DbiamImportError({
                code: 400,
                i18nKey: ImportErrorI18nTypes.CSV_FILE_EMPTY_ERROR,
            }),
        ],
        [
            ImportTextFileCreationError.name,
            new DbiamImportError({
                code: 500,
                i18nKey: ImportErrorI18nTypes.IMPORT_TEXT_FILE_CREATION_ERROR,
            }),
        ],
        [
            ImportNurLernAnSchuleUndKlasseError.name,
            new DbiamImportError({
                code: 400,
                i18nKey: ImportErrorI18nTypes.IMPORT_NUR_LERN_AN_SCHULE_ERROR,
            }),
        ],
    ]);

    public catch(exception: ImportDomainError, host: ArgumentsHost): void {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();

        const dbiamImportError: DbiamImportError = this.mapDomainErrorToDbiamError(exception);

        response.status(dbiamImportError.code);
        response.json(dbiamImportError);
    }

    private mapDomainErrorToDbiamError(error: ImportDomainError): DbiamImportError {
        return (
            this.ERROR_MAPPINGS.get(error.constructor.name) ??
            new DbiamImportError({
                code: 500,
                i18nKey: ImportErrorI18nTypes.IMPORT_ERROR,
            })
        );
    }
}
