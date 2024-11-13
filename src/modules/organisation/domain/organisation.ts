import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { KlassenNameAnSchuleEindeutigError } from '../specification/error/klassen-name-an-schule-eindeutig.error.js';
import { NameRequiredForKlasseError } from '../specification/error/name-required-for-klasse.error.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { NameRequiredForKlasse } from '../specification/name-required-for-klasse.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { NameValidator } from '../../../shared/validation/name-validator.js';
import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';
import { NameForOrganisationWithTrailingSpaceError } from '../specification/error/name-with-trailing-space.error.js';
import { OrganisationsTyp, Traegerschaft } from './organisation.enums.js';

export class Organisation<WasPersisted extends boolean> {
    private constructor(
        public id: Persisted<string, WasPersisted>,
        public createdAt: Persisted<Date, WasPersisted>,
        public updatedAt: Persisted<Date, WasPersisted>,
        public version: Persisted<number, WasPersisted>,
        public administriertVon?: string,
        public zugehoerigZu?: string,
        public kennung?: string,
        public name?: string,
        public namensergaenzung?: string,
        public kuerzel?: string,
        public typ?: OrganisationsTyp,
        public traegerschaft?: Traegerschaft,
        public emailDomain?: string,
        public emailAdress?: string,
    ) {}

    public static construct<WasPersisted extends boolean = false>(
        id: Persisted<string, WasPersisted>,
        createdAt: Persisted<Date, WasPersisted>,
        updatedAt: Persisted<Date, WasPersisted>,
        version: number,
        administriertVon?: string,
        zugehoerigZu?: string,
        kennung?: string,
        name?: string,
        namensergaenzung?: string,
        kuerzel?: string,
        typ?: OrganisationsTyp,
        traegerschaft?: Traegerschaft,
        emailDomain?: string,
        emailAdress?: string,
    ): Organisation<WasPersisted> {
        return new Organisation(
            id,
            createdAt,
            updatedAt,
            version,
            administriertVon,
            zugehoerigZu,
            kennung,
            name,
            namensergaenzung,
            kuerzel,
            typ,
            traegerschaft,
            emailDomain,
            emailAdress,
        );
    }

    public static createNew(
        administriertVon?: string,
        zugehoerigZu?: string,
        kennung?: string,
        name?: string,
        namensergaenzung?: string,
        kuerzel?: string,
        typ?: OrganisationsTyp,
        traegerschaft?: Traegerschaft,
        emailDomain?: string,
        emailAdress?: string,
    ): Organisation<false> | DomainError {
        const organisation: Organisation<false> = new Organisation(
            undefined,
            undefined,
            undefined,
            undefined,
            administriertVon,
            zugehoerigZu,
            kennung,
            name,
            namensergaenzung,
            kuerzel,
            typ,
            traegerschaft,
            emailDomain,
            emailAdress,
        );

        const validationError: void | OrganisationSpecificationError = organisation.validateFieldNames();
        if (validationError) {
            return validationError;
        }

        return organisation;
    }

    public async checkKlasseSpecifications(
        organisationRepository: OrganisationRepository,
    ): Promise<undefined | OrganisationSpecificationError> {
        const validationError: void | OrganisationSpecificationError = this.validateFieldNames();
        if (validationError) {
            return validationError;
        }
        const nameRequiredForKlasse: NameRequiredForKlasse = new NameRequiredForKlasse();
        if (!(await nameRequiredForKlasse.isSatisfiedBy(this))) {
            return new NameRequiredForKlasseError();
        }
        //Refactor this to use KlassenNameAnSchuleEindeutig when ticket SPSH-738 is merged
        if (!(await this.validateClassNameIsUniqueOnSchool(organisationRepository))) {
            return new KlassenNameAnSchuleEindeutigError(this.id ?? undefined);
        }

        return undefined;
    }

    private async validateClassNameIsUniqueOnSchool(organisationRepository: OrganisationRepository): Promise<boolean> {
        if (this.typ !== OrganisationsTyp.KLASSE) return true;
        if (!this.administriertVon) return false;
        const parent: Option<Organisation<true>> = await organisationRepository.findById(this.administriertVon);
        if (!parent) return false;
        //check that parent is of type SCHULE is done in a different specification
        const otherChildOrgas: Organisation<true>[] = await organisationRepository.findChildOrgasForIds([parent.id]);
        for (const otherChildOrga of otherChildOrgas) {
            if (otherChildOrga.typ === OrganisationsTyp.KLASSE) {
                if (otherChildOrga.name === this.name) return false; //not satisfied if another Klasse already has same name
            }
        }
        return true;
    }

    private validateFieldNames(): void | OrganisationSpecificationError {
        if (this.name && !NameValidator.isNameValid(this.name)) {
            return new NameForOrganisationWithTrailingSpaceError();
        }

        if (this.kennung && !NameValidator.isNameValid(this.kennung)) {
            return new KennungForOrganisationWithTrailingSpaceError();
        }

        return undefined;
    }

    public setVersionForUpdate(version: number): void {
        this.version = version;
    }
}
