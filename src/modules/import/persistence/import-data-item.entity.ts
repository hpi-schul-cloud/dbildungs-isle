import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { Entity, Property } from '@mikro-orm/core';

@Entity({ tableName: 'importdataitem' })
export class ImportDataItemEntity extends TimestampedEntity {
    @Property({ columnType: 'uuid' })
    public readonly importvorgangId!: string;

    @Property()
    public readonly nachname!: string;

    @Property()
    public readonly vorname!: string;

    @Property({ nullable: true })
    public readonly klasse?: string;

    @Property({ nullable: true })
    public personalnummer?: string;
}
