import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import {
    DbiamPersonenkontextError,
    PersonenkontextSpecificationErrorI18nTypes,
} from './dbiam-personenkontext.error.js';
import { NurLehrUndLernAnKlasseError } from '../specification/error/nur-lehr-und-lern-an-klasse.error.js';
import { GleicheRolleAnKlasseWieSchuleError } from '../specification/error/gleiche-rolle-an-klasse-wie-schule.error.js';
import { PersonenkontextSpecificationError } from '../specification/error/personenkontext-specification.error.js';
import { PersonenkontexteUpdateCountError } from '../specification/error/personenkontexte-update-count.error.js';
import { PersonenkontexteUpdateNotFoundError } from '../specification/error/personenkontexte-update-not-found.error.js';

@Catch(PersonenkontextSpecificationError)
export class PersonenkontextExceptionFilter implements ExceptionFilter<PersonenkontextSpecificationError> {
    private ERROR_MAPPINGS: Map<string, DbiamPersonenkontextError> = new Map([
        [
            NurLehrUndLernAnKlasseError.name,
            new DbiamPersonenkontextError({
                code: 400,
                i18nKey: PersonenkontextSpecificationErrorI18nTypes.NUR_LEHR_UND_LERN_AN_KLASSE,
            }),
        ],
        [
            GleicheRolleAnKlasseWieSchuleError.name,
            new DbiamPersonenkontextError({
                code: 400,
                i18nKey: PersonenkontextSpecificationErrorI18nTypes.GLEICHE_ROLLE_AN_KLASSE_WIE_SCHULE,
            }),
        ],
        [
            PersonenkontexteUpdateCountError.name,
            new DbiamPersonenkontextError({
                code: 400,
                i18nKey: PersonenkontextSpecificationErrorI18nTypes.COUNT_MISMATCHING_ERROR,
            }),
        ],
        [
            PersonenkontexteUpdateNotFoundError.name,
            new DbiamPersonenkontextError({
                code: 400,
                i18nKey: PersonenkontextSpecificationErrorI18nTypes.PERSONENKONTEXT_NOT_FOUND,
            }),
        ],
    ]);

    public catch(exception: PersonenkontextSpecificationError, host: ArgumentsHost): void {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();
        const status: number = 400; //all errors regarding organisation specifications are BadRequests

        const dbiamRolleError: DbiamPersonenkontextError = this.mapDomainErrorToDbiamError(exception);

        response.status(status);
        response.json(dbiamRolleError);
    }

    private mapDomainErrorToDbiamError(error: PersonenkontextSpecificationError): DbiamPersonenkontextError {
        return (
            this.ERROR_MAPPINGS.get(error.constructor.name) ??
            new DbiamPersonenkontextError({
                code: 500,
                i18nKey: PersonenkontextSpecificationErrorI18nTypes.PERSONENKONTEXT_SPECIFICATION_ERROR,
            })
        );
    }
}
