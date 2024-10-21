import { ImportDomainError } from './import-domain.error.js';

export class ImportCSVFileEmptyError extends ImportDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`CSV File could not be parsed because the file is empty`, undefined, details);
    }
}
