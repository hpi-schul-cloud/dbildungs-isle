export type ExternalSystemIDs = {
    ID_ITSLEARNING?: string[];
    ID_OX?: string[];
};

export type KcCustomAttributes = Record<string, string[]>;

export class User<WasPersisted extends boolean> {
    private constructor(
        public id: Persisted<string, WasPersisted>,
        public username: string,
        public email: string | undefined,
        public createdDate: Persisted<Date, WasPersisted>,
        public externalSystemIDs: ExternalSystemIDs,
        public enabled: boolean,
        public attributes: KcCustomAttributes,
    ) {}

    public static createNew(
        username: string,
        email: string | undefined,
        externalSystemIDs: ExternalSystemIDs,
    ): User<false> {
        return new User(undefined, username, email, undefined, externalSystemIDs, true, {});
    }

    public static construct<WasPersisted extends boolean = true>(
        id: string,
        username: string,
        email: string | undefined,
        createdDate: Date,
        externalSystemIDs: ExternalSystemIDs,
        enabled: boolean,
        attributes: KcCustomAttributes,
    ): User<WasPersisted> {
        return new User(id, username, email, createdDate, externalSystemIDs, enabled, attributes);
    }
}
