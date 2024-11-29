import { BaseEntity, Entity, Enum, ManyToOne, PrimaryKeyProp, Rel } from '@mikro-orm/core';
import { RollenMerkmal } from '../domain/rolle.enums.js';
import { RolleEntity } from './rolle.entity.js';

@Entity({ tableName: 'rolle_merkmal' })
export class RolleMerkmalEntity extends BaseEntity {
    @ManyToOne({ primary: true, entity: () => RolleEntity })
    public rolle!: Rel<RolleEntity>;

    @Enum({ primary: true, items: () => RollenMerkmal, nativeEnumName: 'rollen_merkmal_enum' })
    public merkmal!: RollenMerkmal;

    public [PrimaryKeyProp]?: ['rolle', 'merkmal'];
}
