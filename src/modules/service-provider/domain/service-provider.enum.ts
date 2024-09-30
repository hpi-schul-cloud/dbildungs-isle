export const ServiceProviderKategorieTypName: string = 'ServiceProviderKategorie';
export const ServiceProviderTargetTypName: string = 'ServiceProviderTarget';

export enum ServiceProviderKategorie {
    EMAIL = 'EMAIL',
    UNTERRICHT = 'UNTERRICHT',
    VERWALTUNG = 'VERWALTUNG',
    HINWEISE = 'HINWEISE',
    ANGEBOTE = 'ANGEBOTE',
}

export enum ServiceProviderTarget {
    URL = 'URL',
    EMAIL = 'EMAIL',
    SCHULPORTAL_ADMINISTRATION = 'SCHULPORTAL_ADMINISTRATION',
}

export enum ServiceProviderSystem {
    NONE = 'NONE',
    EMAIL = 'EMAIL',
    ITSLEARNING = 'ITSLEARNING',
}
