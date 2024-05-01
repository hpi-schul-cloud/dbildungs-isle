import { Injectable } from '@nestjs/common';
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import {
    DomainError,
    EntityCouldNotBeCreated,
    EntityCouldNotBeUpdated,
    EntityNotFoundError,
} from '../../../shared/error/index.js';
import { OrganisationDo } from './organisation.do.js';
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

@Injectable()
export class OrganisationService {
    public constructor(private readonly organisationRepo: OrganisationRepo) {}

    public async createOrganisation(
        organisationDo: OrganisationDo<false>,
    ): Promise<Result<OrganisationDo<true>, DomainError>> {
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

        const validationResult: Result<void, DomainError> = await this.validateKennung(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }

        const organisation: OrganisationDo<true> = await this.organisationRepo.save(organisationDo);
        if (organisation) {
            return { ok: true, value: organisation };
        }
        return { ok: false, error: new EntityCouldNotBeCreated(`Organization could not be created`) };
    }

    public async updateOrganisation(
        organisationDo: OrganisationDo<true>,
    ): Promise<Result<OrganisationDo<true>, DomainError>> {
        const storedOrganisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(
            organisationDo.id,
        );
        if (!storedOrganisation) {
            return { ok: false, error: new EntityNotFoundError('Organisation', organisationDo.id) };
        }

        const validationResult: Result<void, DomainError> = await this.validateKennung(organisationDo);
        if (!validationResult.ok) {
            return { ok: false, error: validationResult.error };
        }

        const organisation: OrganisationDo<true> = await this.organisationRepo.save(organisationDo);
        if (organisation) {
            return { ok: true, value: organisation };
        }

        return {
            ok: false,
            error: new EntityCouldNotBeUpdated(`Organization could not be updated`, organisationDo.id),
        };
    }

    private async validateKennung(organisation: OrganisationDo<boolean>): Promise<Result<void, DomainError>> {
        const kennungRequiredForSchule: KennungRequiredForSchule = new KennungRequiredForSchule();
        if (!(await kennungRequiredForSchule.isSatisfiedBy(organisation))) {
            return { ok: false, error: new KennungRequiredForSchuleError() };
        }

        return { ok: true, value: undefined };
    }

    public async findOrganisationById(id: string): Promise<Result<OrganisationDo<true>, DomainError>> {
        const organisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(id);
        if (organisation) {
            return { ok: true, value: organisation };
        }
        return { ok: false, error: new EntityNotFoundError('Organization', id) };
    }

    public async findAllOrganizations(
        organisationDo: Partial<OrganisationDo<false>>,
        offset?: number,
        limit?: number,
    ): Promise<Paged<OrganisationDo<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .findBy({
                kennung: organisationDo.kennung,
                name: organisationDo.name,
                typ: organisationDo.typ,
            })
            .paged(offset, limit);
        const [organisations, total]: Counted<OrganisationDo<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
        };
    }

    public async setAdministriertVon(parentId: string, childId: string): Promise<Result<void, DomainError>> {
        const parentExists: boolean = await this.organisationRepo.exists(parentId);
        if (!parentExists) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            };
        }

        const childOrganisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(childId);
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
        childOrganisation: OrganisationDo<true>,
        parentId: string,
    ): Promise<Result<boolean, DomainError>> {
        //check version from DB before administriertVon is altered
        if (!childOrganisation.administriertVon) return { ok: false, error: new RootOrganisationImmutableError() };
        childOrganisation.administriertVon = parentId;

        return this.validateSpecifications(childOrganisation);
    }

    public async setZugehoerigZu(parentId: string, childId: string): Promise<Result<void, DomainError>> {
        const parentExists: boolean = await this.organisationRepo.exists(parentId);
        if (!parentExists) {
            return {
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            };
        }

        const childOrganisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(childId);
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
        childOrganisation: OrganisationDo<true>,
        parentId: string,
    ): Promise<Result<boolean, DomainError>> {
        //check version from DB before zugehoerigZu is altered
        if (!childOrganisation.zugehoerigZu) return { ok: false, error: new RootOrganisationImmutableError() };
        childOrganisation.zugehoerigZu = parentId;

        return this.validateSpecifications(childOrganisation);
    }

    private async validateSpecifications(
        childOrganisation: OrganisationDo<true>,
    ): Promise<Result<boolean, DomainError>> {
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

    public async findAllAdministriertVon(
        parentOrganisationID: string,
        offset?: number,
        limit?: number,
    ): Promise<Paged<OrganisationDo<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .findAdministrierteVon(parentOrganisationID)
            .paged(offset, limit);

        const [organisations, total]: Counted<OrganisationDo<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
        };
    }

    public async findAllZugehoerigZu(
        parentOrganisationID: string,
        offset?: number,
        limit?: number,
    ): Promise<Paged<OrganisationDo<true>>> {
        const scope: OrganisationScope = new OrganisationScope()
            .findZugehoerigeZu(parentOrganisationID)
            .paged(offset, limit);

        const [organisations, total]: Counted<OrganisationDo<true>> = await this.organisationRepo.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: organisations,
        };
    }
}
