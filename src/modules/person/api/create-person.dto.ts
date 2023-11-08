import { AutoMap } from '@automapper/classes';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';

export class CreatePersonDto {
    @AutoMap()
    public readonly username!: string;

    @AutoMap()
    public readonly email?: string;

    @AutoMap()
    public readonly referrer?: string;

    @AutoMap()
    public readonly mandant!: string;

    @AutoMap()
    public readonly stammorganisation?: string;

    @AutoMap()
    public readonly familienname!: string;

    @AutoMap()
    public readonly vorname!: string;

    @AutoMap()
    public readonly initialenFamilienname?: string;

    @AutoMap()
    public readonly initialenVorname?: string;

    @AutoMap()
    public readonly rufname?: string;

    @AutoMap()
    public readonly nameTitel?: string;

    @AutoMap(() => [String])
    public readonly nameAnrede?: string[];

    @AutoMap(() => [String])
    public readonly namePraefix?: string[];

    @AutoMap(() => [String])
    public readonly nameSuffix?: string[];

    @AutoMap()
    public readonly nameSortierindex?: string;

    @AutoMap(() => Date)
    public readonly geburtsdatum?: Date;

    @AutoMap()
    public readonly geburtsort?: string;

    @AutoMap(() => String)
    public readonly geschlecht?: Geschlecht;

    @AutoMap()
    public readonly lokalisierung?: string;

    @AutoMap(() => String)
    public readonly vertrauensstufe?: Vertrauensstufe;

    @AutoMap()
    public readonly auskunftssperre?: boolean;
}
