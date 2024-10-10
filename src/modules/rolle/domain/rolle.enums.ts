export const RollenArtTypName: string = 'RollenArt';
export const RollenMerkmalTypName: string = 'RollenMerkmal';
export const RollenSystemRechtTypName: string = 'RollenSystemRecht';

export enum RollenArt {
    LERN = 'LERN',
    LEHR = 'LEHR',
    EXTERN = 'EXTERN',
    ORGADMIN = 'ORGADMIN',
    LEIT = 'LEIT',
    SYSADMIN = 'SYSADMIN',
}

export enum RollenMerkmal {
    BEFRISTUNG_PFLICHT = 'BEFRISTUNG_PFLICHT',
    KOPERS_PFLICHT = 'KOPERS_PFLICHT',
}

export enum RollenSystemRecht {
    ROLLEN_VERWALTEN = 'ROLLEN_VERWALTEN',
    PERSONEN_SOFORT_LOESCHEN = 'PERSONEN_SOFORT_LOESCHEN',
    PERSONEN_VERWALTEN = 'PERSONEN_VERWALTEN',
    SCHULEN_VERWALTEN = 'SCHULEN_VERWALTEN',
    KLASSEN_VERWALTEN = 'KLASSEN_VERWALTEN',
    SCHULTRAEGER_VERWALTEN = 'SCHULTRAEGER_VERWALTEN',
    MIGRATION_DURCHFUEHREN = 'MIGRATION_DURCHFUEHREN',
    PERSON_SYNCHRONISIEREN = 'PERSON_SYNCHRONISIEREN',
}

export enum RollenSort {
    ADMINISTERED_BY_SCHULSTRUKTURKNOTEN_NAME = 'administeredBySchulstrukturknotenName',
    NAME = 'name',
    ROLLENART = 'rollenart',
    SERVICE_PROVIDERS = 'serviceProviders',
    MERKMALE = 'merkmale',
}
