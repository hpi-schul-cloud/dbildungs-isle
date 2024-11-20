import { ImportDomainError } from './import-domain.error.js';

export class ImportCSVFileInvalidHeaderError extends ImportDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`CSV File could not be parsed because the file contains invalid headers`, undefined, details);
    }
}
