import { Cascade, DateTimeType, Entity, Enum, Index, ManyToOne, Opt, Property, Ref, Unique } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { Jahrgangsstufe, Personenstatus, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { RolleEntity } from '../../rolle/entity/rolle.entity.js';
import { AutoMap } from '@automapper/classes';

@Entity({ tableName: 'personenkontext' })
@Unique({ properties: ['personId', 'organisationId', 'rolleId'] })
export class PersonenkontextEntity extends TimestampedEntity {
    @AutoMap()
    @ManyToOne({
        fieldName: 'person_id',
        columnType: 'uuid',
        cascade: [Cascade.REMOVE],
        ref: true,
        nullable: false,
        entity: () => PersonEntity,
    })
    @Index({ name: 'personenkontext_person_id_index' })
    public personId!: Ref<PersonEntity>;

    // TODO EW-636: get from access_token, see SchulConneX (Version 1.003.003.000) page 91
    @AutoMap()
    @Property({ columnType: 'uuid', nullable: true })
    public organisationId!: string;

    @ManyToOne({
        fieldName: 'rolle_id',
        columnType: 'uuid',
        ref: true,
        nullable: false,
        entity: () => RolleEntity,
    })
    public rolleId!: Ref<RolleEntity>;

    @AutoMap()
    @Property({ nullable: true })
    public referrer?: string;

    // TODO EW-636: mandant is related to organizations so it is not set for now. When implemented should be set to nullable: false

    @AutoMap()
    @Property({ nullable: true })
    public mandant?: string;

    @AutoMap(() => String)
    @Enum({ nullable: true, items: () => Personenstatus, nativeEnumName: 'personenstatus_enum' })
    public personenstatus?: Personenstatus;

    @AutoMap(() => String)
    @Enum({ nullable: true, items: () => Jahrgangsstufe, nativeEnumName: 'jahrgangsstufe_enum' })
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

    @AutoMap(() => Date)
    @Property({ nullable: true, type: DateTimeType })
    public readonly befristung?: Date;
}
