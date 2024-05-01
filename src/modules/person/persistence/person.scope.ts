import { EntityName } from '@mikro-orm/core';
import { ScopeBase, ScopeOperator } from '../../../shared/persistence/index.js';
import { PersonEntity } from './person.entity.js';

type FindProps = {
    vorname: string;
    familienname: string;
    geburtsdatum: Date;
};

export class PersonScope extends ScopeBase<PersonEntity> {
    public override get entityName(): EntityName<PersonEntity> {
        return PersonEntity;
    }

    public findBy(findProps: Findable<FindProps>, operator: ScopeOperator = ScopeOperator.AND): this {
        this.findByInternal(
            {
                vorname: findProps.vorname,
                familienname: findProps.familienname,
                geburtsdatum: findProps.geburtsdatum,
            },
            operator,
        );

        return this;
    }
}
