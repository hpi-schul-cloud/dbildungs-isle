import { ImportDataItemStatus } from './importDataItem.enum.js';

export class ImportDataItem<WasPersisted extends boolean> {
    private constructor(
        public id: Persisted<string, WasPersisted>,
        public createdAt: Persisted<Date, WasPersisted>,
        public updatedAt: Persisted<Date, WasPersisted>,
        public importvorgangId: string,
        public nachname: string,
        public vorname: string,
        public klasse?: string,
        public personalnummer?: string,
        public validationErrors?: string[],
        public username?: string,
        public password?: string,
        public status?: ImportDataItemStatus,
    ) {}

    public static construct<WasPersisted extends boolean = false>(
        id: Persisted<string, WasPersisted>,
        createdAt: Persisted<Date, WasPersisted>,
        updatedAt: Persisted<Date, WasPersisted>,
        importvorgangId: string,
        nachname: string,
        vorname: string,
        klasse?: string,
        personalnummer?: string,
        validationErrors?: string[],
        username?: string,
        password?: string,
        status?: ImportDataItemStatus,
    ): ImportDataItem<WasPersisted> {
        return new ImportDataItem(
            id,
            createdAt,
            updatedAt,
            importvorgangId,
            nachname,
            vorname,
            klasse,
            personalnummer,
            validationErrors,
            username,
            password,
            status,
        );
    }

    public static createNew(
        importvorgangId: string,
        nachname: string,
        vorname: string,
        klasse?: string,
        personalnummer?: string,
        validationErrors?: string[],
    ): ImportDataItem<false> {
        return new ImportDataItem(
            undefined,
            undefined,
            undefined,
            importvorgangId,
            nachname,
            vorname,
            klasse,
            personalnummer,
            validationErrors,
        );
    }

    public setPassword(password: string): void {
        this.password = password;
    }
}
