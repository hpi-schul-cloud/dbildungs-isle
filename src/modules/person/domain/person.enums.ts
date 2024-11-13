export const VertrauensstufeTypName: string = 'Vertrauensstufe';
export const GeschlechtTypName: string = 'Geschlecht';

export enum Vertrauensstufe {
    KEIN = 'KEIN',
    UNBE = 'UNBE',
    TEIL = 'TEIL',
    VOLL = 'VOLL',
}

export enum Geschlecht {
    M = 'm',
    W = 'w',
    D = 'd',
    X = 'x',
}
export enum SortFieldPersonFrontend {
    FAMILIENNAME = 'familienname',
    VORNAME = 'vorname',
    PERSONALNUMMER = 'personalnummer',
    REFERRER = 'referrer',
}

export enum PersonLockOccasion {
    KOPERS_GESPERRT = 'KOPERS_GESPERRT',
    MANUELL_GESPERRT = 'MANUELL_GESPERRT',
}
