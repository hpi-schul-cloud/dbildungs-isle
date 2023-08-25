import { TimestampedEntity } from './timestamped.entity.js';
import { Entity, PrimaryKey } from '@mikro-orm/core';

@Entity({ tableName: 'permission' })
export class PermissionEntity extends TimestampedEntity<PermissionEntity, 'id'> {
    @PrimaryKey()
    public readonly id!: string;
}
