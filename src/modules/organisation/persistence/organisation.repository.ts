import { EntityManager, Loaded, RequiredEntityData } from '@mikro-orm/postgresql';
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
    );
}

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

            rawResult = await this.em.execute(query, [ids]);
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

            rawResult = await this.em.execute(query, [ids]);
        }

        return rawResult.map(mapEntityToAggregate);
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

    public async find(limit?: number, offset?: number): Promise<Organisation<true>[]> {
        const organisations: OrganisationEntity[] = await this.em.findAll(OrganisationEntity, {
            limit: limit,
            offset: offset,
        });
        return organisations.map(mapEntityToAggregate);
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
        limit?: number,
    ): Promise<Organisation<true>[]> {
        const scope: OrganisationScope = new OrganisationScope();

        scope
            .searchString(searchStr)
            .setScopeWhereOperator(ScopeOperator.AND)
            .paged(0, limit)
            .excludeTyp([excludeOrganisationType]);

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
        const organisationEntity: Organisation<true> = await this.save(organisationFound);
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

        while (parentOrgaId) {
            const result: Option<Organisation<true>> = await this.findById(parentOrgaId);

            if (result?.id === oeffentlich?.id) {
                return RootDirectChildrenType.OEFFENTLICH;
            } else if (result?.id === ersatz?.id) {
                return RootDirectChildrenType.ERSATZ;
            }

            parentOrgaId = result?.administriertVon;
        }

        return RootDirectChildrenType.OEFFENTLICH;
    }
}
