import { ImportDomainError } from './import-domain.error.js';

export class ImportTextFileCreationError extends ImportDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Text File for the import result could not be created`, undefined, details);
    }
}
