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
    ): ImportDataItem<WasPersisted> {
        return new ImportDataItem(id, createdAt, updatedAt, importvorgangId, nachname, vorname, klasse, personalnummer);
    }

    public static createNew(
        importvorgangId: string,
        nachname: string,
        vorname: string,
        klasse?: string,
        personalnummer?: string,
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
        );
    }
}
