import { BigIntType, Cascade, Collection, Entity, Enum, OneToMany, Opt, Property } from '@mikro-orm/core';
import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import { RollenArt } from '../domain/rolle.enums.js';
import { RolleMerkmalEntity } from './rolle-merkmal.entity.js';
import { RolleServiceProviderEntity } from './rolle-service-provider.entity.js';
import { RolleSystemrechtEntity } from './rolle-systemrecht.entity.js';
import { PersonenkontextEntity } from '../../personenkontext/persistence/personenkontext.entity.js';

@Entity({ tableName: 'rolle' })
export class RolleEntity extends TimestampedEntity {
    @Property()
    public name!: string;

    /**
     * Points to Schulstrukturknoten
     */
    @Property({ columnType: 'uuid' })
    public administeredBySchulstrukturknoten!: string;

    @Enum({ items: () => RollenArt, nativeEnumName: 'rollen_art_enum' })
    public rollenart!: RollenArt;

    @OneToMany({
        entity: () => RolleMerkmalEntity,
        mappedBy: 'rolle',
        orphanRemoval: true,
        cascade: [Cascade.ALL],
    })
    public merkmale: Collection<RolleMerkmalEntity> = new Collection<RolleMerkmalEntity>(this);

    @OneToMany({
        entity: () => RolleSystemrechtEntity,
        mappedBy: 'rolle',
        orphanRemoval: true,
        cascade: [Cascade.ALL],
    })
    public systemrechte: Collection<RolleSystemrechtEntity> = new Collection<RolleSystemrechtEntity>(this);

    @OneToMany({
        entity: () => RolleServiceProviderEntity,
        mappedBy: 'rolle',
        orphanRemoval: true,
        cascade: [Cascade.ALL],
    })
    public serviceProvider: Collection<RolleServiceProviderEntity> = new Collection<RolleServiceProviderEntity>(this);

    @OneToMany({
        entity: () => PersonenkontextEntity,
        mappedBy: 'rolleId',
        cascade: [Cascade.REMOVE],
        orphanRemoval: true,
    })
    public personenKontexte: Collection<PersonenkontextEntity> = new Collection<PersonenkontextEntity>(this);

    @Property({
        default: false,
    })
    public istTechnisch!: boolean;

    @Property({ type: new BigIntType('number'), defaultRaw: '1', concurrencyCheck: true })
    public version!: number & Opt;
}
