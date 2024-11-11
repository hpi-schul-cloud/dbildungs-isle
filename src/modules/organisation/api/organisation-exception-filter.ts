import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { KennungRequiredForSchuleError } from '../specification/error/kennung-required-for-schule.error.js';
import { SchuleUnterTraegerError } from '../specification/error/schule-unter-traeger.error.js';
import { TraegerInTraegerError } from '../specification/error/traeger-in-traeger.error.js';
import { NurKlasseKursUnterSchuleError } from '../specification/error/nur-klasse-kurs-unter-schule.error.js';
import { ZyklusInOrganisationenError } from '../specification/error/zyklus-in-organisationen.error.js';
import { RootOrganisationImmutableError } from '../specification/error/root-organisation-immutable.error.js';
import { KlasseNurVonSchuleAdministriertError } from '../specification/error/klasse-nur-von-schule-administriert.error.js';
import { KlassenNameAnSchuleEindeutigError } from '../specification/error/klassen-name-an-schule-eindeutig.error.js';
import { DbiamOrganisationError, OrganisationSpecificationErrorI18nTypes } from './dbiam-organisation.error.js';
import { NameRequiredForSchuleError } from '../specification/error/name-required-for-schule.error.js';
import { SchuleKennungEindeutigError } from '../specification/error/schule-kennung-eindeutig.error.js';
import { OrganisationIstBereitsZugewiesenError } from '../domain/organisation-ist-bereits-zugewiesen.error.js';
import { NameRequiredForKlasseError } from '../specification/error/name-required-for-klasse.error.js';
import { NameForOrganisationWithTrailingSpaceError } from '../specification/error/name-with-trailing-space.error.js';
import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';
import { EmailAdressOnOrganisationTypError } from '../specification/error/email-adress-on-organisation-typ-error.js';
import { OrganisationUpdateOutdatedError } from '../domain/orga-update-outdated.error.js';

@Catch(OrganisationSpecificationError)
export class OrganisationExceptionFilter implements ExceptionFilter<OrganisationSpecificationError> {
    private ERROR_MAPPINGS: Map<string, DbiamOrganisationError> = new Map([
        [
            KennungRequiredForSchuleError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.KENNUNG_REQUIRED_FOR_SCHULE,
            }),
        ],
        [
            NameRequiredForSchuleError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.NAME_REQUIRED_FOR_SCHULE,
            }),
        ],
        [
            SchuleKennungEindeutigError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.SCHULE_KENNUNG_EINDEUTIG,
            }),
        ],
        [
            SchuleUnterTraegerError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.SCHULE_UNTER_TRAEGER,
            }),
        ],
        [
            TraegerInTraegerError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.TRAEGER_IN_TRAEGER,
            }),
        ],
        [
            NurKlasseKursUnterSchuleError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.NUR_KLASSE_UNTER_SCHULE,
            }),
        ],
        [
            ZyklusInOrganisationenError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.ZYKLUS_IN_ORGANISATION,
            }),
        ],
        [
            RootOrganisationImmutableError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.ROOT_ORGANISATION_IMMUTABLE,
            }),
        ],
        [
            KlasseNurVonSchuleAdministriertError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.KLASSE_NUR_VON_SCHULE_ADMINISTRIERT,
            }),
        ],
        [
            KlassenNameAnSchuleEindeutigError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.KLASSENNAME_AN_SCHULE_EINDEUTIG,
            }),
        ],
        [
            OrganisationIstBereitsZugewiesenError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.ORGANISATION_IST_BEREITS_ZUGEWIESEN_ERROR,
            }),
        ],
        [
            NameRequiredForKlasseError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.NAME_REQUIRED_FOR_KLASSE,
            }),
        ],
        [
            NameForOrganisationWithTrailingSpaceError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.NAME_ENTHAELT_LEERZEICHEN,
            }),
        ],
        [
            KennungForOrganisationWithTrailingSpaceError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.KENNUNG_ENTHAELT_LEERZEICHEN,
            }),
        ],
        [
            EmailAdressOnOrganisationTypError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.EMAIL_ADRESS_ON_ORGANISATION_TYP,
            }),
        ],
        [
            OrganisationUpdateOutdatedError.name,
            new DbiamOrganisationError({
                code: 400,
                i18nKey: OrganisationSpecificationErrorI18nTypes.NEWER_VERSION_ORGANISATION,
            }),
        ],
    ]);

    public catch(exception: OrganisationSpecificationError, host: ArgumentsHost): void {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();
        const status: number = 400; //all errors regarding organisation specifications are BadRequests

        const dbiamOrganisationError: DbiamOrganisationError = this.mapDomainErrorToDbiamError(exception);

        response.status(status);
        response.json(dbiamOrganisationError);
    }

    private mapDomainErrorToDbiamError(error: OrganisationSpecificationError): DbiamOrganisationError {
        return (
            this.ERROR_MAPPINGS.get(error.constructor.name) ??
            new DbiamOrganisationError({
                code: 500,
                i18nKey: OrganisationSpecificationErrorI18nTypes.ORGANISATION_SPECIFICATION_ERROR,
            })
        );
    }
}
