import { Loaded, QBFilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { OrganisationID, PersonID, PersonenkontextID, RolleID } from '../../../shared/types/index.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { PersonenkontextEntity } from './personenkontext.entity.js';
import { PersonenkontextScope } from './personenkontext.scope.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';

function mapEntityToAggregate(
    entity: PersonenkontextEntity,
    personenkontextFactory: PersonenkontextFactory,
): Personenkontext<boolean> {
    return personenkontextFactory.construct(
        entity.id,
        entity.createdAt,
        entity.updatedAt,
        entity.revision,
        entity.personId.id,
        entity.organisationId,
        entity.rolleId.id,
        entity.referrer,
        entity.mandant,
        entity.personenstatus,
        entity.jahrgangsstufe,
        entity.sichtfreigabe,
        entity.loeschungZeitpunkt,
        entity.befristung,
    );
}

@Injectable()
export class DBiamPersonenkontextRepo {
    public constructor(
        private readonly em: EntityManager,
        private readonly personenkontextFactory: PersonenkontextFactory,
    ) {}

    public async findByID(id: string): Promise<Option<Personenkontext<true>>> {
        const personenkontext: Option<PersonenkontextEntity> = await this.em.findOne(PersonenkontextEntity, {
            id,
        });

        return personenkontext && mapEntityToAggregate(personenkontext, this.personenkontextFactory);
    }

    public async findByIDAuthorized(
        id: PersonenkontextID,
        permissions: PersonPermissions,
    ): Promise<Result<Personenkontext<true>, DomainError>> {
        const personenkontext: Option<PersonenkontextEntity> = await this.em.findOne(PersonenkontextEntity, {
            id,
        });

        if (!personenkontext) {
            return {
                ok: false,
                error: new EntityNotFoundError('Personenkontext', id),
            };
        }

        if (
            !(await permissions.hasSystemrechtAtOrganisation(
                personenkontext.organisationId,
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ))
        ) {
            return {
                ok: false,
                error: new MissingPermissionsError('Access denied'),
            };
        }

        return { ok: true, value: mapEntityToAggregate(personenkontext, this.personenkontextFactory) };
    }

    public async findByPerson(personId: PersonID): Promise<Personenkontext<true>[]> {
        const personenKontexte: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, {
            personId,
        });

        return personenKontexte.map((pk: PersonenkontextEntity) =>
            mapEntityToAggregate(pk, this.personenkontextFactory),
        );
    }

    /**
     *
     * @param personId
     * @param permissions
     * @returns
     *
     * Should return all kontexts of a given person, if the caller has the systemrecht PERSONEN_VERWALTEN at at least one node of the target persons kontexts
     */
    public async findByPersonAuthorized(
        personId: PersonID,
        permissions: PersonPermissions,
    ): Promise<Result<Personenkontext<true>[], DomainError>> {
        const canSeeKontexts: boolean = await permissions.canModifyPerson(personId);
        if (canSeeKontexts) {
            const allKontextsForTargetPerson: Personenkontext<true>[] = await this.findByPerson(personId);
            return {
                ok: true,
                value: allKontextsForTargetPerson,
            };
        }

        return {
            ok: false,
            error: new MissingPermissionsError('Not allowed to view the requested personenkontexte'),
        };
    }

    public async findBy(scope: PersonenkontextScope): Promise<Counted<Personenkontext<true>>> {
        const [entities, total]: Counted<PersonenkontextEntity> = await scope.executeQuery(this.em);
        const kontexte: Personenkontext<true>[] = entities.map((entity: PersonenkontextEntity) =>
            mapEntityToAggregate(entity, this.personenkontextFactory),
        );

        return [kontexte, total];
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

    public async find(
        personId: PersonID,
        organisationId: OrganisationID,
        rolleId: RolleID,
    ): Promise<Option<Personenkontext<true>>> {
        const personenKontext: Option<PersonenkontextEntity> = await this.em.findOne(
            PersonenkontextEntity,
            {
                personId,
                rolleId,
                organisationId,
            },
            {},
        );
        if (personenKontext) {
            return mapEntityToAggregate(personenKontext, this.personenkontextFactory);
        }

        return null;
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

    public async hasSystemrechtAtOrganisation(
        personId: PersonID,
        organisationId: OrganisationID,
        systemrecht: RollenSystemRecht,
    ): Promise<boolean> {
        const query: string = `
            WITH RECURSIVE parent_organisations AS (
                SELECT id, administriert_von
                FROM public.organisation
                WHERE id = ?
                UNION ALL
                SELECT o.id, o.administriert_von
                FROM public.organisation o
                INNER JOIN parent_organisations po ON o.id = po.administriert_von
            ),
            person_roles_at_orgas AS (
                SELECT DISTINCT pk.rolle_id
                FROM parent_organisations po
                JOIN public.personenkontext pk ON pk.organisation_id = po.id AND pk.person_id = ?
            )
            SELECT EXISTS (
                SELECT 1
                FROM person_roles_at_orgas pr
                JOIN public.rolle_systemrecht sr ON sr.rolle_id = pr.rolle_id
                WHERE sr.systemrecht = ?
            ) AS has_systemrecht_at_orga;
                        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any[] = await this.em.execute(query, [organisationId, personId, systemrecht]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return result[0].has_systemrecht_at_orga as boolean;
    }

    public async hasPersonASystemrechtAtAnyKontextOfPersonB(
        personIdA: PersonID,
        personIdB: PersonID,
        systemrecht: RollenSystemRecht,
    ): Promise<boolean> {
        const query: string = `
        WITH RECURSIVE all_orgas_where_personb_has_any_kontext_with_parents AS (
                    SELECT id, administriert_von
                    FROM public.organisation
                    WHERE id IN (
                        SELECT organisation_id
                        FROM public.personenkontext
                        WHERE person_id = ?
                    )
                    UNION ALL
                    SELECT o.id, o.administriert_von
                    FROM public.organisation o
                    INNER JOIN all_orgas_where_personb_has_any_kontext_with_parents po ON o.id = po.administriert_von
                ),
                kontexts_personB_at_orgas AS (
                    SELECT pk.*
                    FROM public.personenkontext pk
                    WHERE pk.person_id = ? AND pk.organisation_id IN (SELECT id FROM all_orgas_where_personb_has_any_kontext_with_parents)
                ),
                permission_check AS (
                    SELECT EXISTS (
                        SELECT 1
                        FROM kontexts_personB_at_orgas kb
                        JOIN public.rolle_systemrecht sr ON sr.rolle_id = kb.rolle_id
                        WHERE sr.systemrecht = ?
                    ) AS has_persona_systemrecht_at_any_kontext_of_personb
                )
                SELECT has_persona_systemrecht_at_any_kontext_of_personb FROM permission_check;
                    `;

        const result: [{ has_persona_systemrecht_at_any_kontext_of_personb: boolean }] = await this.em.execute(query, [
            personIdB,
            personIdA,
            systemrecht,
        ]);
        return result[0].has_persona_systemrecht_at_any_kontext_of_personb;
    }

    public async isOrganisationAlreadyAssigned(organisationId: string): Promise<boolean> {
        const personenKontexte: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, {
            organisationId,
        });

        return personenKontexte.length > 0;
    }

    public async isRolleAlreadyAssigned(id: RolleID): Promise<boolean> {
        return (await this.findByRolle(id)).length > 0;
    }

    public async getPersonenKontexteWithExpiredBefristung(): Promise<Map<PersonID, Personenkontext<true>[]>> {
        const filters: QBFilterQuery<PersonenkontextEntity> = {
            personId: {
                personenKontexte: {
                    $some: {
                        befristung: {
                            $lt: new Date(),
                        },
                    },
                },
            },
        };

        const personenKontexteEntities: PersonenkontextEntity[] = await this.em.find(PersonenkontextEntity, filters);
        const personenKontexte: Personenkontext<true>[] = personenKontexteEntities.map((pk: PersonenkontextEntity) =>
            mapEntityToAggregate(pk, this.personenkontextFactory),
        );

        // Grouping the entities by personId
        const groupedByPerson: Map<PersonID, Personenkontext<true>[]> = new Map();
        for (const kontext of personenKontexte) {
            const group: Personenkontext<true>[] = groupedByPerson.get(kontext.personId) ?? [];
            if (group.length === 0) {
                groupedByPerson.set(kontext.personId, group);
            }
            group.push(kontext);
        }

        return groupedByPerson;
    }
}
