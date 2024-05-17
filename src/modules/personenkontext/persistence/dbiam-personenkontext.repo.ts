import { Loaded, RequiredEntityData, rel } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { OrganisationID, PersonID, RolleID } from '../../../shared/types/index.js';
import { Rolle } from '../domain/personenkontext.enums.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { PersonenkontextEntity } from './personenkontext.entity.js';
import { PersonEntity } from '../../person/persistence/person.entity.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityAlreadyExistsError } from '../../../shared/error/entity-already-exists.error.js';

export function mapAggregateToData(
    personenKontext: Personenkontext<boolean>,
): RequiredEntityData<PersonenkontextEntity> {
    return {
        // Don't assign createdAt and updatedAt, they are auto-generated!
        id: personenKontext.id,
        personId: rel(PersonEntity, personenKontext.personId),
        organisationId: personenKontext.organisationId,
        rolleId: personenKontext.rolleId,
        rolle: Rolle.LERNENDER, // Placeholder, until rolle is removed from entity
    };
}

function mapEntityToAggregate(
    entity: PersonenkontextEntity,
    personenkontextFactory: PersonenkontextFactory,
): Personenkontext<boolean> {
    return personenkontextFactory.construct(
        entity.id,
        entity.createdAt,
        entity.updatedAt,
        entity.personId.id,
        entity.organisationId,
        entity.rolleId,
    );
}

@Injectable()
export class DBiamPersonenkontextRepo {
    public constructor(
        private readonly em: EntityManager,
        private readonly personenkontextFactory: PersonenkontextFactory,
    ) {}

    public async findByPerson(personId: PersonID): Promise<Personenkontext<true>[]> {
        const personenKontexte: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, {
            personId,
        });

        return personenKontexte.map((pk: PersonenkontextEntity) =>
            mapEntityToAggregate(pk, this.personenkontextFactory),
        );
    }

    public async findByPersonIds(personIds: PersonID[]): Promise<Map<PersonID, Personenkontext<true>[]>> {
        const personenKontextEntities: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, {
            personId: { $in: personIds },
        });

        const personenKontextMap: Map<PersonID, Personenkontext<true>[]> = new Map();

        personenKontextEntities.forEach((entity: PersonenkontextEntity) => {
            const aggregate: Personenkontext<true> = mapEntityToAggregate(entity, this.personenkontextFactory);
            if (!personenKontextMap.has(entity.personId.id)) {
                personenKontextMap.set(entity.personId.id, []);
            }
            personenKontextMap.get(entity.personId.id)!.push(aggregate);
        });

        return personenKontextMap;
    }

    public async findByRolle(rolleId: string): Promise<Personenkontext<true>[]> {
        const personenKontexte: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, {
            rolleId,
        });

        return personenKontexte.map((pk: PersonenkontextEntity) =>
            mapEntityToAggregate(pk, this.personenkontextFactory),
        );
    }

    public async exists(personId: PersonID, organisationId: OrganisationID, rolleId: RolleID): Promise<boolean> {
        const personenKontext: Option<Loaded<PersonenkontextEntity, never, 'id', never>> = await this.em.findOne(
            PersonenkontextEntity,
            {
                personId,
                rolleId,
                organisationId,
            },
            { fields: ['id'] as const },
        );

        return !!personenKontext;
    }

    public async save(personenKontext: Personenkontext<boolean>): Promise<Personenkontext<true>> {
        if (personenKontext.id) {
            return this.update(personenKontext);
        } else {
            return this.create(personenKontext);
        }
    }

    private async create(personenKontext: Personenkontext<false>): Promise<Personenkontext<true>> {
        const personenKontextEntity: PersonenkontextEntity = this.em.create(
            PersonenkontextEntity,
            mapAggregateToData(personenKontext),
        );
        try {
            await this.em.persistAndFlush(personenKontextEntity);
        } catch (error: unknown) {
            console.log(error);
        }

        return mapEntityToAggregate(personenKontextEntity, this.personenkontextFactory);
    }

    private async update(personenKontext: Personenkontext<true>): Promise<Personenkontext<true>> {
        const personenKontextEntity: Loaded<PersonenkontextEntity> = await this.em.findOneOrFail(
            PersonenkontextEntity,
            personenKontext.id,
        );
        personenKontextEntity.assign(mapAggregateToData(personenKontext));

        await this.em.persistAndFlush(personenKontextEntity);

        return mapEntityToAggregate(personenKontextEntity, this.personenkontextFactory);
    }

    public async createAuthorized(
        personenkontext: Personenkontext<false>,
        permissions: PersonPermissions,
    ): Promise<Result<Personenkontext<true>, DomainError>> {
        {
            const result: Option<DomainError> = await personenkontext.checkRolleZuweisungPermissions(permissions);
            if (result) {
                return {
                    ok: false,
                    error: result,
                };
            }
        }

        {
            const exists: boolean = await this.exists(
                personenkontext.personId,
                personenkontext.organisationId,
                personenkontext.rolleId,
            );

            if (exists) {
                return {
                    ok: false,
                    error: new EntityAlreadyExistsError('Personenkontext already exists'),
                };
            }
        }

        const personenKontextEntity: PersonenkontextEntity = this.em.create(
            PersonenkontextEntity,
            mapAggregateToData(personenkontext),
        );

        await this.em.persistAndFlush(personenKontextEntity);

        return {
            ok: true,
            value: mapEntityToAggregate(personenKontextEntity, this.personenkontextFactory),
        };
    }
}
