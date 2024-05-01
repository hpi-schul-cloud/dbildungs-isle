import { CompositeSpecification } from '../../specification/specifications.js';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';

export class KlassenNameAnSchuleEindeutig extends CompositeSpecification<OrganisationDo<boolean>> {
    public constructor(private readonly organisationRepo: OrganisationRepo) {
        super();
    }

    public async isSatisfiedBy(t: OrganisationDo<boolean>): Promise<boolean> {
        if (t.typ !== OrganisationsTyp.KLASSE) return true;
        return this.validateClassNameIsUniqueOnSchool(t);
    }

    private async validateClassNameIsUniqueOnSchool(t: OrganisationDo<boolean>): Promise<boolean> {
        if (!t.administriertVon) return false;
        const parent: Option<OrganisationDo<true>> = await this.organisationRepo.findById(t.administriertVon);
        if (!parent) return false;
        //check that parent is of type SCHULE is done in a different specification
        const otherChildOrgas: OrganisationDo<true>[] = await this.organisationRepo.findChildOrgasForIds([parent.id]);
        for (const otherChildOrga of otherChildOrgas) {
            if (otherChildOrga.typ === OrganisationsTyp.KLASSE) {
                if (otherChildOrga.name === t.name) return false; //not satisfied if another Klasse already has same name
            }
        }
        return true;
    }
}
