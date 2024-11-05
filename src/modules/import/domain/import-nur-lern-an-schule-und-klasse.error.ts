import { ImportDomainError } from './import-domain.error.js';

export class ImportNurLernAnSchuleUndKlasseError extends ImportDomainError {
    public constructor(details?: unknown[] | Record<string, undefined>) {
        super(`Only rolle with rollenart LERN can be imported for schule and klasse`, undefined, details);
    }
}
