import { EntityManager, Loaded, RequiredEntityData } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { UserLock } from '../domain/user-lock.js';
import { UserLockEntity } from '../entity/user-lock.entity.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PersonLockOccasion } from '../../person/domain/person.enums.js';

export function mapEntityToAggregate(entity: UserLockEntity): UserLock {
    return UserLock.construct(
        entity.person.id,
        entity.locked_by,
        entity.locked_until,
        entity.locked_occasion,
        entity.createdAt,
    );
}

export function mapAggregateToData(userLock: UserLock): RequiredEntityData<UserLockEntity> {
    return {
        person: userLock.person,
        locked_by: userLock.locked_by,
        locked_until: userLock.locked_until,
        locked_occasion: userLock.locked_occasion,
    };
}

export function mapEntityToAggregateInplace(entity: UserLockEntity, userLock: UserLock): UserLock {
    userLock.person = entity.person.id;
    userLock.locked_by = entity.locked_by;
    userLock.locked_until = entity.locked_until;
    userLock.locked_occasion = entity.locked_occasion;

    return userLock;
}

@Injectable()
export class UserLockRepository {
    public constructor(private readonly em: EntityManager) {}

    public async findByPersonId(id: PersonID): Promise<UserLock[]> {
        const users: Option<UserLockEntity[]> = await this.em.find(UserLockEntity, { person: id });
        return users.map(mapEntityToAggregate);
    }

    public async createUserLock(userLock: UserLock): Promise<UserLock | DomainError> {
        const userLockEntity: UserLockEntity = this.em.create(UserLockEntity, mapAggregateToData(userLock));
        await this.em.persistAndFlush(userLockEntity);

        return mapEntityToAggregateInplace(userLockEntity, userLock);
    }

    public async update(userLock: UserLock): Promise<UserLock | DomainError> {
        const userLockEntity: Loaded<UserLockEntity> = await this.em.findOneOrFail(UserLockEntity, {
            person: userLock.person,
        });
        userLockEntity.assign(mapAggregateToData(userLock));
        await this.em.persistAndFlush(userLockEntity);
        return mapEntityToAggregate(userLockEntity);
    }

    public async deleteUserLock(personId: string, lockOccasion: PersonLockOccasion): Promise<void> {
        await this.em.nativeDelete(UserLockEntity, { person: personId, locked_occasion: lockOccasion });
    }
}
