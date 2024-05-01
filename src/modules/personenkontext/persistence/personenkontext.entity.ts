import { AutoMap } from '@automapper/classes';
import { DateTimeType, Entity, Enum, Opt, Property, Unique } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { Jahrgangsstufe, Personenstatus, Rolle, SichtfreigabeType } from '../domain/personenkontext.enums.js';

@Entity({ tableName: 'personenkontext' })
@Unique({ properties: ['personId', 'organisationId', 'rolleId'] })
export class PersonenkontextEntity extends TimestampedEntity {
    @AutoMap()
    @Property({ columnType: 'uuid', nullable: false })
    public personId!: string;

    // TODO EW-636: get from access_token, see SchulConneX (Version 1.003.003.000) page 91
    @AutoMap()
    @Property({ columnType: 'uuid', nullable: true })
    public organisationId!: string;

    // Will be mandatory soon. PersonenkontextAggregate will always set ID.
    @Property({ columnType: 'uuid', nullable: true })
    public rolleId!: string;

    @AutoMap()
    @Property({ nullable: true })
    public referrer?: string;

    // TODO EW-636: mandant is related to organizations so it is not set for now. When implemented should be set to nullable: false
    @AutoMap()
    @Property({ nullable: true })
    public mandant?: string;

    // Will be removed in favor of `rolleId`.
    @AutoMap(() => String)
    @Enum({ nullable: false, items: () => Rolle })
    public rolle!: Rolle;

    @AutoMap(() => String)
    @Enum({ nullable: true, items: () => Personenstatus })
    public personenstatus?: Personenstatus;

    @AutoMap(() => String)
    @Enum({ nullable: true, items: () => Jahrgangsstufe })
    public jahrgangsstufe?: Jahrgangsstufe;

    @AutoMap(() => String)
    @Property({ nullable: true, default: SichtfreigabeType.NEIN })
    public sichtfreigabe?: SichtfreigabeType;

    @AutoMap(() => Date)
    @Property({ nullable: true, type: DateTimeType })
    public loeschungZeitpunkt?: Date;

    @AutoMap(() => String)
    @Property({ nullable: false, default: '1' })
    public revision!: string & Opt;
}
