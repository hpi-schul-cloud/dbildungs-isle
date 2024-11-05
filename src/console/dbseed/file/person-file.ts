import { Geschlecht, Vertrauensstufe } from '../../../modules/person/domain/person.enums.js';

export class PersonFile {
    public id?: number;

    public overrideId?: string;

    public username?: string;

    public password?: string;

    public keycloakUserId!: string;

    public referrer?: string;

    public mandant!: string;

    public stammorganisation?: string;

    public familienname!: string;

    public vorname!: string;

    public initialenFamilienname?: string;

    public initialenVorname?: string;

    public rufname?: string;

    public nameTitel?: string;

    public nameAnrede?: string[];

    public namePraefix?: string[];

    public nameSuffix?: string[];

    public nameSortierindex?: string;

    public geburtsdatum?: Date;

    public geburtsort?: string;

    public geschlecht?: Geschlecht;

    public lokalisierung?: string;

    public vertrauensstufe?: Vertrauensstufe;

    public auskunftssperre?: boolean;

    public dataProvider?: string;

    public revision!: string;

    public personalnummer?: string;
}
