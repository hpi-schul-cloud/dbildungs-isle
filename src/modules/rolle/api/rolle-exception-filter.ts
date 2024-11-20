import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import { AddSystemrechtError } from './add-systemrecht.error.js';
import { DbiamRolleError, RolleErrorI18nTypes } from './dbiam-rolle.error.js';
import { RolleDomainError } from '../domain/rolle-domain.error.js';
import { RolleHatPersonenkontexteError } from '../domain/rolle-hat-personenkontexte.error.js';
import { UpdateMerkmaleError } from '../domain/update-merkmale.error.js';
import { NameForRolleWithTrailingSpaceError } from '../domain/name-with-trailing-space.error.js';
import { RolleUpdateOutdatedError } from '../domain/update-outdated.error.js';
import { RolleNameNotUniqueOnSskError } from '../specification/error/rolle-name-not-unique-on-ssk.error.js';

@Catch(RolleDomainError)
export class RolleExceptionFilter implements ExceptionFilter<RolleDomainError> {
    private ERROR_MAPPINGS: Map<string, DbiamRolleError> = new Map([
        [
            AddSystemrechtError.name,
            new DbiamRolleError({
                code: 500,
                i18nKey: RolleErrorI18nTypes.ADD_SYSTEMRECHT_ERROR,
            }),
        ],
        [
            RolleHatPersonenkontexteError.name,
            new DbiamRolleError({
                code: 400,
                i18nKey: RolleErrorI18nTypes.ROLLE_HAT_PERSONENKONTEXTE_ERROR,
            }),
        ],
        [
            UpdateMerkmaleError.name,
            new DbiamRolleError({
                code: 400,
                i18nKey: RolleErrorI18nTypes.UPDATE_MERKMALE_ERROR,
            }),
        ],
        [
            NameForRolleWithTrailingSpaceError.name,
            new DbiamRolleError({
                code: 400,
                i18nKey: RolleErrorI18nTypes.ROLLENNAME_ENTHAELT_LEERZEICHEN,
            }),
        ],
        [
            RolleUpdateOutdatedError.name,
            new DbiamRolleError({
                code: 400,
                i18nKey: RolleErrorI18nTypes.NEWER_VERSION_OF_ROLLE_AVAILABLE,
            }),
        ],
        [
            RolleNameNotUniqueOnSskError.name,
            new DbiamRolleError({
                code: 400,
                i18nKey: RolleErrorI18nTypes.ROLLE_NAME_UNIQUE_ON_SSK,
            }),
        ],
    ]);

    public catch(exception: RolleDomainError, host: ArgumentsHost): void {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();

        const dbiamRolleError: DbiamRolleError = this.mapDomainErrorToDbiamError(exception);

        response.status(dbiamRolleError.code);
        response.json(dbiamRolleError);
    }

    private mapDomainErrorToDbiamError(error: RolleDomainError): DbiamRolleError {
        return (
            this.ERROR_MAPPINGS.get(error.constructor.name) ??
            new DbiamRolleError({
                code: 500,
                i18nKey: RolleErrorI18nTypes.ROLLE_ERROR,
            })
        );
    }
}
