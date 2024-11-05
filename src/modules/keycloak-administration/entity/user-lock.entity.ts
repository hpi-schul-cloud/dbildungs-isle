import { Entity, Property, ManyToOne, Rel } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';

@Entity({ tableName: 'user_lock' })
export class UserLockEntity extends TimestampedEntity {
    @ManyToOne({ entity: () => PersonEntity })
    public readonly person!: Rel<PersonEntity>;

    @Property({ nullable: false })
    public locked_by!: string;

    @Property({ nullable: true })
    public locked_until?: Date;
}
