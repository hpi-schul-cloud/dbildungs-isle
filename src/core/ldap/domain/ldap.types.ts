export type LdapPersonEntry = {
    cn: string;
    sn: string;
    mailPrimaryAddress?: string;
    mailAlternativeAddress?: string;
    objectclass: string[];
    entryUUID?: string;
    personID?: string;
};

export enum LdapEntityType {
    SCHULE = 'SCHULE',
    LEHRER = 'LEHRER',
}
