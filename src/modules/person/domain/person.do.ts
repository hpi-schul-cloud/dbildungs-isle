import { AutoMap } from '@automapper/classes';
import { DoBase } from '../../../shared/types/index.js';
import { Geschlecht, Vertrauensstufe } from './person.enums.js';

export class PersonDo<WasPersisted extends boolean> implements DoBase<WasPersisted> {
    /**
     * @deprecated This constructor is for automapper only.
     */
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    public constructor() {}

    @AutoMap(() => String)
    public id!: Persisted<string, WasPersisted>;

    @AutoMap(() => Date)
    public createdAt!: Persisted<Date, WasPersisted>;

    @AutoMap(() => Date)
    public updatedAt!: Persisted<Date, WasPersisted>;

    @AutoMap()
    public keycloakUserId!: string;

    @AutoMap()
    public referrer?: string;

    @AutoMap()
    public mandant: string = '';

    @AutoMap()
    public readonly stammorganisation?: string;

    @AutoMap()
    public familienname: string = '';

    @AutoMap()
    public vorname: string = '';

    @AutoMap()
    public initialenFamilienname?: string;

    @AutoMap()
    public initialenVorname?: string;

    @AutoMap()
    public rufname?: string;

    @AutoMap()
    public nameTitel?: string;

    @AutoMap(() => [String])
    public nameAnrede?: string[];

    @AutoMap(() => [String])
    public namePraefix?: string[];

    @AutoMap(() => [String])
    public nameSuffix?: string[];

    @AutoMap()
    public nameSortierindex?: string;

    @AutoMap(() => Date)
    public geburtsdatum?: Date;

    @AutoMap()
    public geburtsort?: string;

    @AutoMap(() => String)
    public geschlecht?: Geschlecht;

    @AutoMap()
    public lokalisierung?: string = 'de-DE';

    @AutoMap(() => String)
    public vertrauensstufe?: Vertrauensstufe;

    @AutoMap()
    public auskunftssperre?: boolean;
}
