import { AutoMap } from '@automapper/classes';
import { ArrayType, DateTimeType, Entity, Enum, ManyToOne, Property } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { DataProviderEntity } from '../../../persistence/data-provider.entity.js';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';

@Entity({ tableName: 'person' })
export class PersonEntity extends TimestampedEntity {
    /**
     * @deprecated This constructor is for automapper only.
     */
    public constructor() {
        super();
    }

    @AutoMap()
    @Property()
    public keycloakUserId!: string;

    @AutoMap()
    @Property({ nullable: true })
    public referrer?: string;

    @AutoMap()
    @Property()
    public mandant!: string;

    @AutoMap()
    @Property({ nullable: true })
    public readonly stammorganisation?: string;

    @AutoMap()
    @Property()
    public familienname!: string;

    @AutoMap()
    @Property()
    public vorname!: string;

    @AutoMap()
    @Property({ nullable: true })
    public initialenFamilienname?: string;

    @AutoMap()
    @Property({ nullable: true })
    public initialenVorname?: string;

    @AutoMap()
    @Property({ nullable: true })
    public rufname?: string;

    @AutoMap()
    @Property({ nullable: true })
    public nameTitel?: string;

    @AutoMap(() => [String])
    @Property({ nullable: true, type: ArrayType })
    public nameAnrede?: string[];

    @AutoMap(() => [String])
    @Property({ nullable: true, type: ArrayType })
    public namePraefix?: string[];

    @AutoMap(() => [String])
    @Property({ nullable: true, type: ArrayType })
    public nameSuffix?: string[];

    @AutoMap()
    @Property({ nullable: true })
    public nameSortierindex?: string;

    @AutoMap()
    @Property({ nullable: true, type: DateTimeType })
    public geburtsdatum?: Date;

    @AutoMap()
    @Property({ nullable: true })
    public geburtsort?: string;

    @AutoMap(() => String)
    @Enum({ items: () => Geschlecht, nullable: true })
    public geschlecht?: Geschlecht;

    @AutoMap()
    @Property({ nullable: true })
    public lokalisierung?: string;

    @AutoMap(() => String)
    @Enum({ items: () => Vertrauensstufe, nullable: true })
    public vertrauensstufe?: Vertrauensstufe;

    @AutoMap()
    @Property({ nullable: true })
    public auskunftssperre?: boolean;

    @ManyToOne({ nullable: true })
    public dataProvider?: DataProviderEntity;

    @AutoMap()
    @Property({ nullable: false, default: '1' })
    public revision!: string;

    @AutoMap()
    @Property({ nullable: true })
    public personalnummer?: string;
}
