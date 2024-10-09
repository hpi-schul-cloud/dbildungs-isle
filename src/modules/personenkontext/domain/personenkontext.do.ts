import { AutoMap } from '@automapper/classes';
import { DoBase } from '../../../shared/types/index.js';
import { Jahrgangsstufe, Personenstatus, SichtfreigabeType } from './personenkontext.enums.js';

export class PersonenkontextDo<WasPersisted extends boolean> implements DoBase<WasPersisted> {
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
    public personId!: string;

    @AutoMap()
    public rolleId!: string;

    @AutoMap()
    public referrer?: string;

    @AutoMap()
    public mandant!: string;

    // TODO EW-636: get from access_token, see SchulConneX / and the the entity only stores the ID
    @AutoMap()
    public organisationId!: string;

    @AutoMap(() => String)
    public personenstatus?: Personenstatus;

    @AutoMap(() => String)
    public jahrgangsstufe?: Jahrgangsstufe;

    @AutoMap(() => String)
    public sichtfreigabe?: SichtfreigabeType;

    @AutoMap(() => Date)
    public loeschungZeitpunkt?: Date;

    @AutoMap()
    public revision!: string;
}
