import { Injectable } from '@nestjs/common';
import {
    DomainError,
    EntityCouldNotBeCreated,
    EntityCouldNotBeUpdated,
    EntityNotFoundError,
} from '../../../shared/error/index.js';
import { Paged } from '../../../shared/paging/paged.js';
import { OrganisationScope } from '../persistence/organisation.scope.js';
import { RootOrganisationImmutableError } from '../specification/error/root-organisation-immutable.error.js';
import { ZyklusInOrganisationenError } from '../specification/error/zyklus-in-organisationen.error.js';
import { NurKlasseKursUnterSchule } from '../specification/nur-klasse-kurs-unter-schule.js';
import { NurKlasseKursUnterSchuleError } from '../specification/error/nur-klasse-kurs-unter-schule.error.js';
import { SchuleUnterTraeger } from '../specification/schule-unter-traeger.js';
import { SchuleUnterTraegerError } from '../specification/error/schule-unter-traeger.error.js';
import { TraegerInTraeger } from '../specification/traeger-in-traeger.js';
import { TraegerInTraegerError } from '../specification/error/traeger-in-traeger.error.js';
import { ZyklusInOrganisationen } from '../specification/zyklus-in-organisationen.js';
import { KennungRequiredForSchule } from '../specification/kennung-required-for-schule.js';
import { KennungRequiredForSchuleError } from '../specification/error/kennung-required-for-schule.error.js';
import { KlasseNurVonSchuleAdministriert } from '../specification/klasse-nur-von-schule-administriert.js';
import { KlasseNurVonSchuleAdministriertError } from '../specification/error/klasse-nur-von-schule-administriert.error.js';
import { KlassenNameAnSchuleEindeutig } from '../specification/klassen-name-an-schule-eindeutig.js';
import { KlassenNameAnSchuleEindeutigError } from '../specification/error/klassen-name-an-schule-eindeutig.error.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { NameRequiredForSchule } from '../specification/name-required-for-schule.js';
import { NameRequiredForSchuleError } from '../specification/error/name-required-for-schule.error.js';
import { ScopeOperator } from '../../../shared/persistence/index.js';
import { SchuleKennungEindeutig } from '../specification/schule-kennung-eindeutig.js';
import { SchuleKennungEindeutigError } from '../specification/error/schule-kennung-eindeutig.error.js';
import { NameValidator } from '../../../shared/validation/name-validator.js';
import { NameForOrganisationWithTrailingSpaceError } from '../specification/error/name-with-trailing-space.error.js';
import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';
import { Organisation } from './organisation.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { EmailAdressOnOrganisationTyp } from '../specification/email-on-organisation-type.js';
import { EmailAdressOnOrganisationTypError } from '../specification/error/email-adress-on-organisation-typ-error.js';

@Injectable()
export class OrganisationService {
    public constructor(private readonly organisationRepo: OrganisationRepository) {}

    public async createOrganisation(
        organisationDo: Organisation<false>,
    ): Promise<Result<Organisation<true>, DomainError>> {
        if (organisationDo.administriertVon && !(await this.organisationRepo.exists(organisationDo.administriertVon))) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', organisationDo.administriertVon),
            };
        }

        if (organisationDo.zugehoerigZu && !(await this.organisationRepo.exists(organisationDo.zugehoerigZu))) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', organisationDo.zugehoerigZu),
            };
        }

        const validationFieldnamesResult: void | DomainError = this.validateFieldNames(organisationDo);
        if (validationFieldnamesResult) {
            return { ok: false, error: validationFieldnamesResult };
        }

        let validationResult: Result<void, DomainError> = await this.validateKennungRequiredForSchule(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateNameRequiredForSchule(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateSchuleKennungUnique(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateEmailAdressOnOrganisationTyp(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }

        const validateKlassen: Result<boolean, DomainError> = await this.validateKlassenSpecifications(organisationDo);
        if (!validateKlassen.ok) {
            return { ok: false, error: validateKlassen.error };
        }

        const organisation: Organisation<true> | OrganisationSpecificationError =
            await this.organisationRepo.save(organisationDo);
        if (organisation instanceof Organisation) {
            return { ok: true, value: organisation };
        }
        return { ok: false, error: new EntityCouldNotBeCreated(`Organization could not be created`) };
    }

    public async updateOrganisation(
        organisationDo: Organisation<true>,
    ): Promise<Result<Organisation<true>, DomainError>> {
        const storedOrganisation: Option<Organisation<true>> = await this.organisationRepo.findById(organisationDo.id);
        if (!storedOrganisation) {
            return { ok: false, error: new EntityNotFoundError('Organisation', organisationDo.id) };
        }

        const validationFieldnamesResult: void | DomainError = this.validateFieldNames(organisationDo);
        if (validationFieldnamesResult) {
            return { ok: false, error: validationFieldnamesResult };
        }

        let validationResult: Result<void, DomainError> = await this.validateKennungRequiredForSchule(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateNameRequiredForSchule(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateSchuleKennungUnique(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        validationResult = await this.validateEmailAdressOnOrganisationTyp(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }

        const validateKlassen: Result<boolean, DomainError> = await this.validateKlassenSpecifications(organisationDo);
        if (!validateKlassen.ok) {
            return { ok: false, error: validateKlassen.error };
        }

        const organisation: Organisation<true> | OrganisationSpecificationError =
            await this.organisationRepo.save(organisationDo);
        if (organisation instanceof Organisation) {
            return { ok: true, value: organisation };
        }

        return {
            ok: false,
            error: new EntityCouldNotBeUpdated(`Organization could not be updated`, organisationDo.id),
        };
    }

    private async validateEmailAdressOnOrganisationTyp(
        organisation: Organisation<boolean>,
    ): Promise<Result<void, DomainError>> {
        const emailAdressOnOrganisationTyp: EmailAdressOnOrganisationTyp = new EmailAdressOnOrganisationTyp();
        if (!(await emailAdressOnOrganisationTyp.isSatisfiedBy(organisation))) {
            return { ok: false, error: new EmailAdressOnOrganisationTypError() };
        }
        return { ok: true, value: undefined };
    }

    private async validateKennungRequiredForSchule(
        organisation: Organisation<boolean>,
    ): Promise<Result<void, DomainError>> {
        const kennungRequiredForSchule: KennungRequiredForSchule = new KennungRequiredForSchule();
        if (!(await kennungRequiredForSchule.isSatisfiedBy(organisation))) {
            return { ok: false, error: new KennungRequiredForSchuleError() };
        }

        return { ok: true, value: undefined };
    }

    private async validateNameRequiredForSchule(
        organisation: Organisation<boolean>,
    ): Promise<Result<void, DomainError>> {
        const nameRequiredForSchule: NameRequiredForSchule = new NameRequiredForSchule();
        if (!(await nameRequiredForSchule.isSatisfiedBy(organisation))) {
            return { ok: false, error: new NameRequiredForSchuleError() };
        }

        return { ok: true, value: undefined };
    }

    private async validateSchuleKennungUnique(organisation: Organisation<boolean>): Promise<Result<void, DomainError>> {
        const schuleKennungEindeutig: SchuleKennungEindeutig = new SchuleKennungEindeutig(this.organisationRepo);
        if (!(await schuleKennungEindeutig.isSatisfiedBy(organisation))) {
            return { ok: false, error: new SchuleKennungEindeutigError() };
        }

        return { ok: true, value: undefined };
    }

    public async findOrganisationById(id: string): Promise<Result<Organisation<true>, DomainError>> {
        const organisation: Option<Organisation<true>> = await this.organisationRepo.findById(id);
        if (organisation) {
            return { ok: true, value: organisation };
        }
        return { ok: false, error: new EntityNotFoundError('Organization', id) };
    }

    public async findAllOrganizations(
        organisationDo: Partial<Organisation<false>>,
        offset?: number,
        limit?: number,
    ): Promise<Paged<Organisation<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .findBy({
                kennung: organisationDo.kennung,
                name: organisationDo.name,
                typ: organisationDo.typ,
            })
            .paged(offset, limit);
        const [organisations, total]: Counted<Organisation<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
            pageTotal: organisations.length,
        };
    }

    public async setAdministriertVon(
        parentId: string,
        childId: string,
    ): Promise<Result<void, OrganisationSpecificationError | DomainError>> {
        const parentExists: boolean = await this.organisationRepo.exists(parentId);
        if (!parentExists) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            };
        }

        const childOrganisation: Option<Organisation<true>> = await this.organisationRepo.findById(childId);
        if (!childOrganisation) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            };
        }
        // MUST be called before administriertVon is altered
        const validationResult: Result<boolean, DomainError> = await this.validateAdministriertVon(
            childOrganisation,
            parentId,
        );

        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }
        childOrganisation.administriertVon = parentId;

        try {
            await this.organisationRepo.save(childOrganisation);
            return { ok: true, value: undefined };
        } catch (e) {
            return { ok: false, error: new EntityCouldNotBeUpdated('Organisation', childId) };
        }
    }

    private async validateAdministriertVon(
        childOrganisation: Organisation<true>,
        parentId: string,
    ): Promise<Result<boolean, OrganisationSpecificationError>> {
        //check version from DB before administriertVon is altered
        if (!childOrganisation.administriertVon) return { ok: false, error: new RootOrganisationImmutableError() };
        childOrganisation.administriertVon = parentId;

        const validateStructureSpecifications: Result<boolean, OrganisationSpecificationError> =
            await this.validateStructureSpecifications(childOrganisation);
        if (!validateStructureSpecifications.ok) return { ok: false, error: validateStructureSpecifications.error };

        const validateKlassenSpecifications: Result<boolean, OrganisationSpecificationError> =
            await this.validateKlassenSpecifications(childOrganisation);
        if (!validateKlassenSpecifications.ok) return { ok: false, error: validateKlassenSpecifications.error };

        return { ok: true, value: true };
    }

    public async setZugehoerigZu(parentId: string, childId: string): Promise<Result<void, DomainError>> {
        const parentExists: boolean = await this.organisationRepo.exists(parentId);
        if (!parentExists) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            };
        }

        const childOrganisation: Option<Organisation<true>> = await this.organisationRepo.findById(childId);
        if (!childOrganisation) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            };
        }

        // MUST be called before zugehoerigZu is altered
        const validationResult: Result<boolean, DomainError> = await this.validateZugehoerigZu(
            childOrganisation,
            parentId,
        );
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }

        childOrganisation.zugehoerigZu = parentId;

        try {
            await this.organisationRepo.save(childOrganisation);
            return { ok: true, value: undefined };
        } catch (e) {
            return { ok: false, error: new EntityCouldNotBeUpdated('Organisation', childId) };
        }
    }

    private async validateZugehoerigZu(
        childOrganisation: Organisation<true>,
        parentId: string,
    ): Promise<Result<boolean, OrganisationSpecificationError>> {
        //check version from DB before zugehoerigZu is altered
        if (!childOrganisation.zugehoerigZu) return { ok: false, error: new RootOrganisationImmutableError() };
        childOrganisation.zugehoerigZu = parentId;

        const validateStructureSpecifications: Result<boolean, OrganisationSpecificationError> =
            await this.validateStructureSpecifications(childOrganisation);
        if (!validateStructureSpecifications.ok) return { ok: false, error: validateStructureSpecifications.error };

        const validateKlassenSpecifications: Result<boolean, OrganisationSpecificationError> =
            await this.validateKlassenSpecifications(childOrganisation);
        if (!validateKlassenSpecifications.ok) return { ok: false, error: validateKlassenSpecifications.error };

        return { ok: true, value: true };
    }

    private async validateKlassenSpecifications(
        childOrganisation: Organisation<boolean>,
    ): Promise<Result<boolean, OrganisationSpecificationError>> {
        const klasseNurVonSchuleAdministriert: KlasseNurVonSchuleAdministriert = new KlasseNurVonSchuleAdministriert(
            this.organisationRepo,
        );
        if (!(await klasseNurVonSchuleAdministriert.isSatisfiedBy(childOrganisation))) {
            return { ok: false, error: new KlasseNurVonSchuleAdministriertError(childOrganisation.id ?? undefined) };
        }
        const klassenNameAnSchuleEindeutig: KlassenNameAnSchuleEindeutig = new KlassenNameAnSchuleEindeutig(
            this.organisationRepo,
        );
        if (!(await klassenNameAnSchuleEindeutig.isSatisfiedBy(childOrganisation))) {
            return { ok: false, error: new KlassenNameAnSchuleEindeutigError(childOrganisation.id ?? undefined) };
        }
        return { ok: true, value: true };
    }

    private async validateStructureSpecifications(
        childOrganisation: Organisation<true>,
    ): Promise<Result<boolean, OrganisationSpecificationError>> {
        const schuleUnterTraeger: SchuleUnterTraeger = new SchuleUnterTraeger(this.organisationRepo);
        if (!(await schuleUnterTraeger.isSatisfiedBy(childOrganisation))) {
            return { ok: false, error: new SchuleUnterTraegerError(childOrganisation.id) };
        }
        const traegerInTraeger: TraegerInTraeger = new TraegerInTraeger(this.organisationRepo);
        if (!(await traegerInTraeger.isSatisfiedBy(childOrganisation))) {
            return { ok: false, error: new TraegerInTraegerError(childOrganisation.id) };
        }
        const nurKlasseKursUnterSchule: NurKlasseKursUnterSchule = new NurKlasseKursUnterSchule(this.organisationRepo);
        if (!(await nurKlasseKursUnterSchule.isSatisfiedBy(childOrganisation))) {
            return { ok: false, error: new NurKlasseKursUnterSchuleError(childOrganisation.id) };
        }
        const zyklusInOrganisationen: ZyklusInOrganisationen = new ZyklusInOrganisationen(this.organisationRepo);
        if (await zyklusInOrganisationen.isSatisfiedBy(childOrganisation)) {
            return { ok: false, error: new ZyklusInOrganisationenError(childOrganisation.id) };
        }
        return { ok: true, value: true };
    }

    private validateFieldNames(organisation: Organisation<boolean>): void | OrganisationSpecificationError {
        if (organisation.name && !NameValidator.isNameValid(organisation.name)) {
            return new NameForOrganisationWithTrailingSpaceError();
        }

        if (organisation.kennung && !NameValidator.isNameValid(organisation.kennung)) {
            return new KennungForOrganisationWithTrailingSpaceError();
        }

        return undefined;
    }

    public async findAllAdministriertVon(
        parentOrganisationID: string,
        searchFilter?: string,
        offset?: number,
        limit?: number,
    ): Promise<Paged<Organisation<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .setScopeWhereOperator(ScopeOperator.AND)
            .findAdministrierteVon(parentOrganisationID)
            .searchStringAdministriertVon(searchFilter)
            .paged(offset, limit);

        const [organisations, total]: Counted<Organisation<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
            pageTotal: organisations.length,
        };
    }

    public async findAllZugehoerigZu(
        parentOrganisationID: string,
        offset?: number,
        limit?: number,
    ): Promise<Paged<Organisation<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .findZugehoerigeZu(parentOrganisationID)
            .paged(offset, limit);

        const [organisations, total]: Counted<Organisation<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
            pageTotal: organisations.length,
        };
    }
}
