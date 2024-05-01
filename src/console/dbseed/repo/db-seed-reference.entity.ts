import { BaseEntity, Entity, Enum, PrimaryKeyProp, Property } from '@mikro-orm/core';

export enum ReferencedEntityType {
    PERSON = 'PERSON',
    ORGANISATION = 'ORGANISATION',
    ROLLE = 'ROLLE',
    SERVICE_PROVIDER = 'SERVICE_PROVIDER',
}

@Entity({ tableName: 'seeding_reference' })
export class DbSeedReferenceEntity extends BaseEntity {
    @Enum(() => ReferencedEntityType)
    public referencedEntityType!: ReferencedEntityType;

    @Property({ primary: true, nullable: false })
    public virtualId!: number;

    @Property({ primary: true, nullable: false })
    public uuid!: string;

    public [PrimaryKeyProp]?: ['virtualId', 'uuid'];
}
