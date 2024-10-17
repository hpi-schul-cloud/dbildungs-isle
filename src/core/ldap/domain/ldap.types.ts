export type LdapPersonEntry = {
    cn: string;
    sn: string;
    mailPrimaryAddress?: string;
    mailAlternativeAddress?: string;
    objectclass: string[];
    entryUUID?: string;
    personID?: string;
};

export type LdapOrganisationEntry = {
    ou: string;
    objectclass: string[];
};

export type LdapRoleEntry = {
    cn: string;
    ou: string;
    objectclass: string[];
};

export enum LdapEntityType {
    SCHULE = 'SCHULE',
    LEHRER = 'LEHRER',
}
