import { Entity, Property, ManyToOne, Rel, Cascade, Unique } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { PersonLockOccasion } from '../../person/domain/person.enums.js';

@Entity({ tableName: 'user_lock' })
@Unique({ properties: ['person', 'locked_occasion'] })
export class UserLockEntity extends TimestampedEntity {
    @ManyToOne({
        entity: () => PersonEntity,
        fieldName: 'person_id',
        columnType: 'uuid',
        cascade: [Cascade.REMOVE],
        ref: true,
        nullable: false,
    })
    public readonly person!: Rel<PersonEntity>;

    @Property({ nullable: false })
    public locked_by!: string;

    @Property({ nullable: true })
    public locked_until?: Date;

    @Property({ nullable: false })
    public locked_occasion!: PersonLockOccasion;
}
