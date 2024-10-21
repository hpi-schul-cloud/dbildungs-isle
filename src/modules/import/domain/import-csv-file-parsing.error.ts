import { ImportDomainError } from './import-domain.error.js';

export class ImportCSVFileParsingError extends ImportDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`CSV File could not be parsed`, undefined, details);
    }
}
