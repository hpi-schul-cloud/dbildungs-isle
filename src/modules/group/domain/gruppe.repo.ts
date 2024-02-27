import { Injectable } from '@nestjs/common';
import { Gruppe } from './gruppe.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { GruppeMapper } from './gruppe.mapper.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityCouldNotBeCreated } from '../../../shared/error/entity-could-not-be-created.error.js';
import { GruppeEntity } from '../persistence/gruppe.entity.js';
@Injectable()
export class GruppenRepository {
    public constructor(
        private readonly em: EntityManager,
        private readonly mapper: GruppeMapper,
    ) {}

    public async createGruppe(gruppe: Gruppe): Promise<Result<GruppeEntity, DomainError>> {
        try {
            const gruppeEntity: GruppeEntity = this.mapper.mapGruppeToGruppeEntity(gruppe);
            await this.em.persistAndFlush(gruppeEntity);
            return { ok: true, value: gruppeEntity };
        } catch (error) {
            return { ok: false, error: new EntityCouldNotBeCreated('Gruppe') };
        }
    }
}
