import { EntityName } from '@mikro-orm/core';
import { ScopeBase } from '../../../shared/persistence/scope-base.js';
import { ScopeOperator } from '../../../shared/persistence/scope.enums.js';
import { Personenstatus, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { PersonenkontextEntity } from './personenkontext.entity.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';

type FindProps = {
    personId: string;
    referrer: string;
    personenstatus: Personenstatus;
    sichtfreigabe: SichtfreigabeType;
};

export class PersonenkontextScope extends ScopeBase<PersonenkontextEntity> {
    public override get entityName(): EntityName<PersonenkontextEntity> {
        return PersonenkontextEntity;
    }

    public findBy(findProps: Findable<FindProps>, operator: ScopeOperator = ScopeOperator.AND): this {
        this.findByInternal(
            {
                personId: findProps.personId,
                referrer: findProps.referrer,
                personenstatus: findProps.personenstatus,
                sichtfreigabe: findProps.sichtfreigabe,
            },
            operator,
        );

        return this;
    }

    public byOrganisations(organisationIDs: OrganisationID[] | undefined): this {
        if (organisationIDs) {
            this.findByQuery({
                organisationId: { $in: organisationIDs },
            });
        }

        return this;
    }
}
