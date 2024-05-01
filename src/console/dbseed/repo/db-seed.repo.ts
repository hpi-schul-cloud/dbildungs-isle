import { Injectable } from '@nestjs/common';
import { EntityManager, Loaded, RequiredEntityData } from '@mikro-orm/core';
import { DbSeed } from '../domain/db-seed.js';
import { DbSeedEntity } from './db-seed.entity.js';

function mapAggregateToData(dbSeed: DbSeed<boolean>): RequiredEntityData<DbSeedEntity> {
    return {
        // Don't assign executedAt, it is auto-generated!
        hash: dbSeed.hash,
        status: dbSeed.status,
        path: dbSeed.path,
    };
}

function mapEntityToAggregate(entity: DbSeedEntity): DbSeed<boolean> {
    return DbSeed.construct(entity.hash, entity.executedAt, entity.status, entity.path);
}

@Injectable()
export class DbSeedRepo {
    public constructor(private em: EntityManager) {}

    public async findById(hash: string): Promise<Option<DbSeed<true>>> {
        const dbSeedEntity: Option<DbSeedEntity> = (await this.em.findOne(DbSeedEntity, {
            hash,
        })) as Option<DbSeedEntity>;

        return dbSeedEntity && mapEntityToAggregate(dbSeedEntity);
    }

    public async create(dbSeed: DbSeed<false>): Promise<DbSeed<true>> {
        const dbSeedEntity: DbSeedEntity = this.em.create(DbSeedEntity, mapAggregateToData(dbSeed));

        await this.em.persistAndFlush(dbSeedEntity);

        return mapEntityToAggregate(dbSeedEntity);
    }

    public async update(dbSeed: DbSeed<true>): Promise<DbSeed<true>> {
        const dbSeedEntity: Loaded<DbSeedEntity> = await this.em.findOneOrFail(DbSeedEntity, { hash: dbSeed.hash });
        dbSeedEntity.assign(mapAggregateToData(dbSeed));

        await this.em.persistAndFlush(dbSeedEntity);

        return mapEntityToAggregate(dbSeedEntity);
    }

    public forkEntityManager(): void {
        this.em = this.em.fork();
    }
}
