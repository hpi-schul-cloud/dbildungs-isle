import { EntityName, QBFilterQuery } from '@mikro-orm/core';
import { ScopeBase, ScopeOperator } from '../../../shared/persistence/index.js';
import { PersonEntity } from './person.entity.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';

type FindProps = {
    vorname: string;
    familienname: string;
    geburtsdatum: Date;
    organisationen: OrganisationID[];
};

export class PersonScope extends ScopeBase<PersonEntity> {
    public override get entityName(): EntityName<PersonEntity> {
        return PersonEntity;
    }

    public findBy(findProps: Findable<FindProps>, operator: ScopeOperator = ScopeOperator.AND): this {
        const filters: QBFilterQuery<PersonEntity> = {
            [operator]: [
                findProps.vorname !== undefined && { vorname: findProps.vorname },
                findProps.familienname !== undefined && { familienname: findProps.familienname },
                findProps.geburtsdatum !== undefined && { geburtsdatum: findProps.geburtsdatum },
                findProps.organisationen !== undefined && {
                    personenKontexte: { $some: { organisationId: { $in: findProps.organisationen } } },
                },
            ].filter(Boolean),
        };

        this.findByQuery(filters);

        return this;
    }

    public findBySearchString(searchStr: string): this {
        this.findBySubstring(['vorname', 'familienname', 'referrer', 'personalnummer'], searchStr, ScopeOperator.OR);

        return this;
    }
}
