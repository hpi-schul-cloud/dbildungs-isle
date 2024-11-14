import { EntityName, QBFilterQuery } from '@mikro-orm/core';
import { ScopeBase, ScopeOperator } from '../../../shared/persistence/index.js';
import { PersonEntity } from './person.entity.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EntityManager, SelectQueryBuilder } from '@mikro-orm/postgresql';

type FindProps = {
    ids?: PersonID[] | undefined[];
    vorname?: string;
    familienname?: string;
    geburtsdatum?: Date;
    organisationen?: OrganisationID[];
};

export class PersonScope extends ScopeBase<PersonEntity> {
    public override get entityName(): EntityName<PersonEntity> {
        return PersonEntity;
    }

    public findBy(findProps: Findable<FindProps>, operator: ScopeOperator = ScopeOperator.AND): this {
        const filters: QBFilterQuery<PersonEntity> = {
            [operator]: [
                findProps.ids !== undefined && {
                    id: { $in: findProps.ids },
                },
                findProps.vorname !== undefined && { vorname: findProps.vorname },
                findProps.familienname !== undefined && { familienname: findProps.familienname },
                findProps.geburtsdatum !== undefined && { geburtsdatum: findProps.geburtsdatum },
                findProps.organisationen !== undefined && {
                    personenKontexte: { $some: { organisationId: { $in: findProps.organisationen } } },
                },
                {
                    personenKontexte: { $none: { rolleId: { istTechnisch: true } } },
                },
            ].filter(Boolean),
        };

        this.findByQuery(filters);

        return this;
    }

    // overriding implementation is necessary to populate emailAddresses for triggering events with email properties. e.g. when person is deleted
    public override async executeQuery(em: EntityManager): Promise<Counted<PersonEntity>> {
        const selectQuery: SelectQueryBuilder<PersonEntity> = this.getQueryBuilder(em);

        const [entities, count]: [PersonEntity[], number] = await selectQuery.getResultAndCount();
        await em.populate(entities, ['emailAddresses']);

        return [entities, count];
    }

    public findByPersonenKontext(organisationen?: string[] | undefined, rollen?: string[] | undefined): this {
        const filters: QBFilterQuery<PersonEntity> = {
            personenKontexte: {
                ...(organisationen ? { organisationId: { $in: organisationen } } : {}),
                ...(rollen ? { rolleId: { $in: rollen } } : {}),
            },
        };
        this.findByQuery(filters);
        return this;
    }

    public findBySearchString(searchStr: string): this {
        this.findBySubstring(['vorname', 'familienname', 'referrer', 'personalnummer'], searchStr, ScopeOperator.OR);

        return this;
    }
}
