import { Entity, Enum, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { EmailAddressStatus } from '../domain/email-address.js';

@Entity({ tableName: 'email_address' })
export class EmailAddressEntity extends TimestampedEntity {
    @ManyToOne({
        columnType: 'uuid',
        fieldName: 'person_id',
        ref: true,
        nullable: true,
        deleteRule: 'set null',
        entity: () => PersonEntity,
    })
    public personId!: Ref<PersonEntity>;

    @Property({ primary: true, nullable: false, unique: true })
    public address!: string;

    @Property({ nullable: true })
    public oxUserId?: string;

    @Enum({ items: () => EmailAddressStatus, nativeEnumName: 'email_address_status_enum' })
    public status!: EmailAddressStatus;
}
