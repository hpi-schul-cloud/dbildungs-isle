import { Injectable } from '@nestjs/common';
import { EntityManager, RequiredEntityData } from '@mikro-orm/core';
import { DbSeedReference } from '../domain/db-seed-reference.js';
import { DbSeedReferenceEntity, ReferencedEntityType } from './db-seed-reference.entity.js';

function mapAggregateToData(dbSeedReference: DbSeedReference): RequiredEntityData<DbSeedReferenceEntity> {
    return {
        // Don't assign executedAt, it is auto-generated!
        referencedEntityType: dbSeedReference.referencedEntityType,
        virtualId: dbSeedReference.virtualId,
        uuid: dbSeedReference.uuid,
    };
}

function mapEntityToAggregate(entity: DbSeedReferenceEntity): DbSeedReference {
    return DbSeedReference.createNew(entity.referencedEntityType, entity.virtualId, entity.uuid);
}

@Injectable()
export class DbSeedReferenceRepo {
    public constructor(private readonly em: EntityManager) {}

    public async findUUID(virtualId: number, referencedEntityType: ReferencedEntityType): Promise<Option<string>> {
        const dbSeedReference: Option<DbSeedReference> = await this.find(virtualId, referencedEntityType);
        return dbSeedReference?.uuid;
    }

    public async find(virtualId: number, referencedEntityType: ReferencedEntityType): Promise<Option<DbSeedReference>> {
        const dbSeedReferenceEntity: Option<DbSeedReferenceEntity> = (await this.em.findOne(DbSeedReferenceEntity, {
            $and: [{ virtualId }, { referencedEntityType }],
        })) as Option<DbSeedReferenceEntity>;

        return dbSeedReferenceEntity && mapEntityToAggregate(dbSeedReferenceEntity);
    }

    public async create(dbSeedReference: DbSeedReference): Promise<DbSeedReference> {
        const dbSeedReferenceEntity: DbSeedReferenceEntity = this.em.create(
            DbSeedReferenceEntity,
            mapAggregateToData(dbSeedReference),
        );

        await this.em.persistAndFlush(dbSeedReferenceEntity);

        return mapEntityToAggregate(dbSeedReferenceEntity);
    }
}
