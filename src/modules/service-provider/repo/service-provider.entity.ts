import { BlobType, Entity, Enum, Property } from '@mikro-orm/core';

import { TimestampedEntity } from '../../../persistence/timestamped.entity.js';
import {
    ServiceProviderKategorie,
    ServiceProviderSystem,
    ServiceProviderTarget,
} from '../domain/service-provider.enum.js';

@Entity({ tableName: 'service_provider' })
export class ServiceProviderEntity extends TimestampedEntity {
    @Property()
    public name!: string;

    @Enum({ items: () => ServiceProviderTarget, nativeEnumName: 'service_provider_target_enum' })
    public target!: ServiceProviderTarget;

    @Property({ nullable: true })
    public url?: string;

    @Property({ columnType: 'uuid' })
    public providedOnSchulstrukturknoten!: string;

    @Enum({ items: () => ServiceProviderKategorie, nativeEnumName: 'service_provider_kategorie_enum' })
    public kategorie!: ServiceProviderKategorie;

    @Property({ type: BlobType, nullable: true })
    public logo?: Buffer;

    @Property({ nullable: true })
    public logoMimeType?: string;

    @Property({ nullable: true })
    public keycloakGroup?: string;

    @Property({ nullable: true })
    public keycloakRole?: string;

    @Enum({ items: () => ServiceProviderSystem, nativeEnumName: 'service_provider_system_enum' })
    public externalSystem!: ServiceProviderSystem;

    @Property()
    public requires2fa!: boolean;
}
