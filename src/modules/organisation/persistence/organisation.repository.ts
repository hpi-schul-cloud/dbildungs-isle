import {
    EntityManager,
    Loaded,
    QBFilterQuery,
    QueryBuilder,
    RequiredEntityData,
    SelectQueryBuilder,
    EntityDictionary,
} from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataConfig, ServerConfig } from '../../../shared/config/index.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { Organisation } from '../domain/organisation.js';
import { OrganisationEntity } from './organisation.entity.js';
import { OrganisationScope } from './organisation.scope.js';
import { OrganisationsTyp, RootDirectChildrenType } from '../domain/organisation.enums.js';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { ScopeOperator } from '../../../shared/persistence/scope.enums.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { EntityCouldNotBeUpdated } from '../../../shared/error/entity-could-not-be-updated.error.js';
import { KlasseDeletedEvent } from '../../../shared/events/klasse-deleted.event.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { KlasseUpdatedEvent } from '../../../shared/events/klasse-updated.event.js';
import { KlasseCreatedEvent } from '../../../shared/events/klasse-created.event.js';
import { PermittedOrgas, PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';

export function mapAggregateToData(organisation: Organisation<boolean>): RequiredEntityData<OrganisationEntity> {
    return {
        id: organisation.id,
        administriertVon: organisation.administriertVon,
        zugehoerigZu: organisation.zugehoerigZu,
        kennung: organisation.kennung,
        name: organisation.name,
        namensergaenzung: organisation.namensergaenzung,
        kuerzel: organisation.kuerzel,
        typ: organisation.typ,
        traegerschaft: organisation.traegerschaft,
        emailDomain: organisation.emailDomain,
        emailAddress: organisation.emailAdress,
    };
}

export function mapEntityToAggregate(entity: OrganisationEntity): Organisation<true> {
    return Organisation.construct(
        entity.id,
        entity.createdAt,
        entity.updatedAt,
        entity.administriertVon,
        entity.zugehoerigZu,
        entity.kennung,
        entity.name,
        entity.namensergaenzung,
        entity.kuerzel,
        entity.typ,
        entity.traegerschaft,
        entity.emailDomain,
        entity.emailAddress,
    );
}

export type OrganisationSeachOptions = {
    readonly kennung?: string;
    readonly name?: string;
    readonly searchString?: string;
    readonly typ?: OrganisationsTyp;
    readonly excludeTyp?: OrganisationsTyp[];
    readonly administriertVon?: string[];
    readonly organisationIds?: string[];
    readonly offset?: number;
    readonly limit?: number;
};

@Injectable()
export class OrganisationRepository {
    public readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly eventService: EventService,
        private readonly em: EntityManager,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    public async findBy(scope: OrganisationScope): Promise<Counted<Organisation<true>>> {
        const [entities, total]: Counted<OrganisationEntity> = await scope.executeQuery(this.em);
        const organisations: Organisation<true>[] = entities.map((entity: OrganisationEntity) =>
            mapEntityToAggregate(entity),
        );
        return [organisations, total];
    }

    public async save(organisation: Organisation<boolean>): Promise<Organisation<true>> {
        if (organisation.id) {
            return this.update(organisation);
        } else {
            return this.create(organisation);
        }
    }

    public async exists(id: OrganisationID): Promise<boolean> {
        const organisation: Option<Loaded<OrganisationEntity, never, 'id', never>> = await this.em.findOne(
            OrganisationEntity,
            { id },
            { fields: ['id'] as const },
        );

        return !!organisation;
    }

    public async findChildOrgasForIds(ids: OrganisationID[]): Promise<Organisation<true>[]> {
        let rawResult: OrganisationEntity[];

        if (ids.length === 0) {
            return [];
        } else if (ids.some((id: OrganisationID) => id === this.ROOT_ORGANISATION_ID)) {
            // If id is the root, perform a simple SELECT * except root for performance enhancement.
            rawResult = await this.em.find(OrganisationEntity, { id: { $ne: this.ROOT_ORGANISATION_ID } });
        } else {
            // Otherwise, perform the recursive CTE query.
            const query: string = `
                WITH RECURSIVE sub_organisations AS (SELECT *
                                                     FROM public.organisation
                                                     WHERE administriert_von IN (?)
                                                     UNION ALL
                                                     SELECT o.*
                                                     FROM public.organisation o
                                                              INNER JOIN sub_organisations so ON o.administriert_von = so.id)
                SELECT DISTINCT ON (id) *
                FROM sub_organisations;
            `;

            const rawEntities: EntityDictionary<OrganisationEntity>[] = await this.em.execute(query, [ids]);
            rawResult = rawEntities.map((data: EntityDictionary<OrganisationEntity>) =>
                this.em.map(OrganisationEntity, data),
            );
        }

        return rawResult.map(mapEntityToAggregate);
    }

    public async findParentOrgasForIds(ids: OrganisationID[]): Promise<Organisation<true>[]> {
        let rawResult: OrganisationEntity[];

        if (ids.length === 0) {
            return [];
        } else {
            const query: string = `
                WITH RECURSIVE parent_organisations AS (
                    SELECT *
                    FROM public.organisation
                    WHERE id IN (?)
                    UNION ALL
                    SELECT o.*
                    FROM public.organisation o
                    INNER JOIN parent_organisations po ON po.administriert_von = o.id
                )
                SELECT DISTINCT ON (id) *
                FROM parent_organisations;
            `;

            const rawEntities: EntityDictionary<OrganisationEntity>[] = await this.em.execute(query, [ids]);
            rawResult = rawEntities.map((data: EntityDictionary<OrganisationEntity>) =>
                this.em.map(OrganisationEntity, data),
            );
        }

        return rawResult.map(mapEntityToAggregate);
    }

    /**
     * Searches for all upper level organisations for a given organisation by its organisationID
     * and returns an array sorted by the depth ascending. Element at index 0 is always the organisationIDs organisation,
     * this way the lowest child is always included. Its direct parent will be at index 1 and so on.
     */
    public async findParentOrgasForIdSortedByDepthAsc(id: OrganisationID): Promise<Organisation<true>[]> {
        const query: string = `
             WITH RECURSIVE parent_organisations AS (
                SELECT *, 0 as depth
                FROM public.organisation
                WHERE id = (?)
                UNION ALL
                SELECT o.*, depth + 1
                FROM public.organisation o
                INNER JOIN parent_organisations po ON po.administriert_von = o.id
            )
            SELECT *
            FROM parent_organisations ORDER BY depth;
        `;

        const rawResult: EntityDictionary<OrganisationEntity>[] = await this.em.execute(query, [id]);

        const res: Organisation<true>[] = rawResult
            .map((data: EntityDictionary<OrganisationEntity>) => this.em.map(OrganisationEntity, data))
            .map(mapEntityToAggregate);

        return res;
    }

    public async isOrgaAParentOfOrgaB(
        organisationIdA: OrganisationID,
        organisationIdB: OrganisationID,
    ): Promise<boolean> {
        const query: string = `
            WITH RECURSIVE parent_organisations AS (SELECT id, administriert_von
                                                    FROM public.organisation
                                                    WHERE id = ?
                                                    UNION ALL
                                                    SELECT o.id, o.administriert_von
                                                    FROM public.organisation o
                                                             INNER JOIN parent_organisations po ON o.id = po.administriert_von)
            SELECT EXISTS (SELECT 1
                           FROM parent_organisations
                           WHERE id = ?) AS is_parent;
        `;

        const result: [{ is_parent: boolean }] = await this.em.execute(query, [organisationIdB, organisationIdA]);
        return result[0].is_parent;
    }

    public async findRootDirectChildren(): Promise<
        [oeffentlich: Organisation<true> | undefined, ersatz: Organisation<true> | undefined]
    > {
        const scope: OrganisationScope = new OrganisationScope().findAdministrierteVon(this.ROOT_ORGANISATION_ID);

        const [entities]: Counted<OrganisationEntity> = await scope.executeQuery(this.em);

        const oeffentlich: OrganisationEntity | undefined = entities.find((entity: OrganisationEntity) =>
            entity.name?.includes('Öffentliche'),
        );

        const ersatz: OrganisationEntity | undefined = entities.find((entity: OrganisationEntity) =>
            entity.name?.includes('Ersatz'),
        );

        return [oeffentlich && mapEntityToAggregate(oeffentlich), ersatz && mapEntityToAggregate(ersatz)];
    }

    public async findById(id: string): Promise<Option<Organisation<true>>> {
        const organisation: Option<OrganisationEntity> = await this.em.findOne(OrganisationEntity, { id });
        if (organisation) {
            return mapEntityToAggregate(organisation);
        }
        return null;
    }

    public async findByIds(ids: string[]): Promise<Map<string, Organisation<true>>> {
        const organisationEntities: OrganisationEntity[] = await this.em.find(OrganisationEntity, { id: { $in: ids } });

        const organisationMap: Map<string, Organisation<true>> = new Map();
        organisationEntities.forEach((organisationEntity: OrganisationEntity) => {
            const organisation: Organisation<true> = mapEntityToAggregate(organisationEntity);
            organisationMap.set(organisationEntity.id, organisation);
        });

        return organisationMap;
    }

    public async findByNameOrKennungAndExcludeByOrganisationType(
        excludeOrganisationType: OrganisationsTyp,
        searchStr?: string,
        permittedOrgaIds?: string[],
        limit?: number,
    ): Promise<Organisation<true>[]> {
        const scope: OrganisationScope = new OrganisationScope();

        // Set up the query with the search string, limit, and excluded type
        scope
            .searchString(searchStr)
            .setScopeWhereOperator(ScopeOperator.AND)
            .paged(0, limit)
            .excludeTyp([excludeOrganisationType]);

        // If permitted organization IDs are provided, add them to the query scope
        if (permittedOrgaIds && permittedOrgaIds.length > 0) {
            scope.filterByIds(permittedOrgaIds);
        }

        // Execute the query and return the result
        let foundOrganisations: Organisation<true>[] = [];
        [foundOrganisations] = await this.findBy(scope);

        return foundOrganisations;
    }

    public async findByNameOrKennung(searchStr: string): Promise<Organisation<true>[]> {
        const organisations: OrganisationEntity[] = await this.em.find(OrganisationEntity, {
            $or: [{ name: { $ilike: '%' + searchStr + '%' } }, { kennung: { $ilike: '%' + searchStr + '%' } }],
        });

        return organisations.map(mapEntityToAggregate);
    }

    public async findAuthorized(
        personPermissions: PersonPermissions,
        systemrechte: RollenSystemRecht[],
        searchOptions: OrganisationSeachOptions,
    ): Promise<Counted<Organisation<true>>> {
        const permittedOrgas: PermittedOrgas = await personPermissions.getOrgIdsWithSystemrecht(systemrechte, true);
        if (!permittedOrgas.all && permittedOrgas.orgaIds.length === 0) {
            return [[], 0];
        }

        let entitiesForIds: OrganisationEntity[] = [];
        const qb: QueryBuilder<OrganisationEntity> = this.em.createQueryBuilder(OrganisationEntity);

        if (searchOptions.organisationIds && searchOptions.organisationIds.length > 0) {
            const organisationIds: string[] = permittedOrgas.all
                ? searchOptions.organisationIds
                : searchOptions.organisationIds.filter((id: string) => permittedOrgas.orgaIds.includes(id));
            const queryForIds: SelectQueryBuilder<OrganisationEntity> = qb
                .select('*')
                .where({ id: { $in: organisationIds } })
                .limit(searchOptions.limit);
            entitiesForIds = (await queryForIds.getResultAndCount())[0];
        }

        let whereClause: QBFilterQuery<OrganisationEntity> = {};
        const andClauses: QBFilterQuery<OrganisationEntity>[] = [];
        if (searchOptions.kennung) {
            andClauses.push({ kennung: searchOptions.kennung });
        }
        if (searchOptions.name) {
            andClauses.push({ name: searchOptions.name });
        }
        if (searchOptions.typ) {
            andClauses.push({ typ: searchOptions.typ });
        }
        if (searchOptions.administriertVon) {
            andClauses.push({ administriertVon: { $in: searchOptions.administriertVon } });
        }
        if (searchOptions.searchString) {
            andClauses.push({ name: { $ilike: `%${searchOptions.searchString}%` } });
        }
        if (searchOptions.excludeTyp) {
            andClauses.push({ typ: { $nin: searchOptions.excludeTyp } });
        }
        if (andClauses.length > 0) {
            whereClause = { $and: andClauses };
        }
        // return only permitted organisations
        if (!permittedOrgas.all) {
            whereClause = { $and: [whereClause, { id: { $in: permittedOrgas.orgaIds } }] };
        }

        const query: SelectQueryBuilder<OrganisationEntity> = qb
            .select('*')
            .where(whereClause)
            .offset(searchOptions.offset)
            .limit(searchOptions.limit);
        const [entities, total]: Counted<OrganisationEntity> = await query.getResultAndCount();

        let result: OrganisationEntity[] = [...entitiesForIds];
        let duplicates: number = 0;
        for (const entity of entities) {
            if (!entitiesForIds.find((orga: OrganisationEntity) => orga.id === entity.id)) {
                result.push(entity);
            } else {
                duplicates++;
            }
        }
        if (searchOptions.limit && entitiesForIds.length > 0) {
            result = result.slice(0, searchOptions.limit);
        }
        const organisations: Organisation<true>[] = result.map((entity: OrganisationEntity) =>
            mapEntityToAggregate(entity),
        );
        return [organisations, total + entitiesForIds.length - duplicates];
    }

    public async deleteKlasse(id: OrganisationID): Promise<Option<DomainError>> {
        const organisationEntity: Option<OrganisationEntity> = await this.em.findOne(OrganisationEntity, { id });
        if (!organisationEntity) {
            return new EntityNotFoundError('Organisation', id);
        }

        if (organisationEntity.typ !== OrganisationsTyp.KLASSE) {
            return new EntityCouldNotBeUpdated('Organisation', id, ['Only Klassen can be deleted.']);
        }

        await this.em.removeAndFlush(organisationEntity);
        this.eventService.publish(new KlasseDeletedEvent(organisationEntity.id));

        return;
    }

    public async updateKlassenname(id: string, newName: string): Promise<DomainError | Organisation<true>> {
        const organisationFound: Option<Organisation<true>> = await this.findById(id);

        if (!organisationFound) {
            return new EntityNotFoundError('Organisation', id);
        }
        if (organisationFound.typ !== OrganisationsTyp.KLASSE) {
            return new EntityCouldNotBeUpdated('Organisation', id, ['Only the name of Klassen can be updated.']);
        }
        //Specifications: it needs to be clarified how the specifications can be checked using DDD principles
        {
            if (organisationFound.name !== newName) {
                organisationFound.name = newName;
                const specificationError: undefined | OrganisationSpecificationError =
                    await organisationFound.checkKlasseSpecifications(this);

                if (specificationError) {
                    return specificationError;
                }
            }
        }
        const organisationEntity: Organisation<true> | OrganisationSpecificationError =
            await this.save(organisationFound);
        this.eventService.publish(new KlasseUpdatedEvent(id, newName, organisationFound.administriertVon));
        return organisationEntity;
    }

    public async saveSeedData(organisation: Organisation<boolean>): Promise<Organisation<true>> {
        return this.create(organisation);
    }

    private async create(organisation: Organisation<boolean>): Promise<Organisation<true>> {
        const organisationEntity: OrganisationEntity = this.em.create(
            OrganisationEntity,
            mapAggregateToData(organisation),
        );

        await this.em.persistAndFlush(organisationEntity);

        if (organisationEntity.typ === OrganisationsTyp.SCHULE) {
            const orgaBaumZuordnung: RootDirectChildrenType = await this.findOrganisationZuordnungErsatzOderOeffentlich(
                organisationEntity.id,
            );
            this.eventService.publish(
                new SchuleCreatedEvent(
                    organisationEntity.id,
                    organisationEntity.kennung,
                    organisationEntity.name,
                    orgaBaumZuordnung,
                ),
            );
        } else if (organisationEntity.typ === OrganisationsTyp.KLASSE) {
            this.eventService.publish(
                new KlasseCreatedEvent(
                    organisationEntity.id,
                    organisationEntity.name,
                    organisationEntity.administriertVon,
                ),
            );
        }

        return mapEntityToAggregate(organisationEntity);
    }

    private async update(organisation: Organisation<true>): Promise<Organisation<true>> {
        const organisationEntity: Loaded<OrganisationEntity> = await this.em.findOneOrFail(
            OrganisationEntity,
            organisation.id,
        );
        organisationEntity.assign(mapAggregateToData(organisation));

        await this.em.persistAndFlush(organisationEntity);

        return mapEntityToAggregate(organisationEntity);
    }

    private async findOrganisationZuordnungErsatzOderOeffentlich(
        organisationId: OrganisationID | undefined,
    ): Promise<RootDirectChildrenType> {
        const [oeffentlich, ersatz]: [Organisation<true> | undefined, Organisation<true> | undefined] =
            await this.findRootDirectChildren();

        let parentOrgaId: OrganisationID | undefined = organisationId;
        /* eslint-disable no-await-in-loop */
        while (parentOrgaId) {
            const result: Option<Organisation<true>> = await this.findById(parentOrgaId);

            if (result?.id === oeffentlich?.id) {
                return RootDirectChildrenType.OEFFENTLICH;
            } else if (result?.id === ersatz?.id) {
                return RootDirectChildrenType.ERSATZ;
            }

            parentOrgaId = result?.administriertVon;
        }
        /* eslint-disable no-await-in-loop */

        return RootDirectChildrenType.OEFFENTLICH;
    }
}
