import { CompositeSpecification } from '../../specification/specifications.js';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';

export class KlasseNurVonSchuleAdministriert extends CompositeSpecification<OrganisationDo<boolean>> {
    public constructor(private readonly organisationRepo: OrganisationRepo) {
        super();
    }

    public async isSatisfiedBy(t: OrganisationDo<boolean>): Promise<boolean> {
        if (t.typ !== OrganisationsTyp.KLASSE) return true;
        return (await this.validateAdministriertVon(t)) && (await this.validateZugehoerigZu(t));
    }

    private async validateAdministriertVon(t: OrganisationDo<boolean>): Promise<boolean> {
        if (!t.administriertVon) return false;
        const parent: Option<OrganisationDo<true>> = await this.organisationRepo.findById(t.administriertVon);
        if (!parent) return false;
        return parent.typ === OrganisationsTyp.SCHULE;
    }

    private async validateZugehoerigZu(t: OrganisationDo<true>): Promise<boolean> {
        if (!t.zugehoerigZu) return false;
        const parent: Option<OrganisationDo<true>> = await this.organisationRepo.findById(t.zugehoerigZu);
        if (!parent) return false;
        return parent.typ === OrganisationsTyp.SCHULE;
    }
}
