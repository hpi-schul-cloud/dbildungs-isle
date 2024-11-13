import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { Response } from 'express';
import { TokenError } from './error/token.error.js';
import { DbiamPersonError } from '../../person/api/dbiam-person.error.js';
import { SerialNotFoundError } from './error/serial-not-found.error.js';
import {
    DbiamPrivacyIdeaAdministrationError,
    PrivacyIdeaAdministrationErrorI18nTypes,
} from './error/dbiam-privacy-idea-administration.error.js';
import { SerialInUseError } from './error/serial-in-use.error.js';
import { OTPnotValidError } from './error/otp-not-valid.error.js';
import { HardwareTokenServiceError } from './error/hardware-token-service.error.js';
import { TokenResetError } from './error/token-reset.error.js';
import { TwoAuthStateError } from './error/two-auth-state.error.js';
import { SoftwareTokenVerificationError } from './error/software-token-verification.error.js';
import { DeleteUserError } from './error/delete-user.error.js';
import { UserExistsError } from './error/user-exists.error.js';
import { SoftwareTokenInitializationError } from './error/software-token-initialization.error.js';
import { TokenStateError } from './error/token-state.error.js';
import { PIUnavailableError } from './error/pi-unavailable.error.js';

@Catch(TokenError)
export class PrivacyIdeaAdministrationExceptionFilter implements ExceptionFilter<TokenError> {
    private ERROR_MAPPINGS: Map<string, DbiamPersonError> = new Map([
        [
            SerialNotFoundError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.SERIENNUMMER_NICHT_GEFUNDEN,
            }),
        ],
        [
            SerialInUseError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.SERIENNUMMER_IN_VERWENDUNG,
            }),
        ],
        [
            OTPnotValidError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.OTP_NICHT_GUELTIG,
            }),
        ],
        [
            HardwareTokenServiceError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.HARDWARE_TOKEN_SERVICE_FEHLER,
            }),
        ],
        [
            TokenResetError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.TOKEN_RESET_ERROR,
            }),
        ],
        [
            TwoAuthStateError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.TWO_AUTH_STATE_ERROR,
            }),
        ],
        [
            SoftwareTokenVerificationError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.SOFTWARE_TOKEN_VERIFICATION_ERROR,
            }),
        ],
        [
            UserExistsError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.USERNAME_EXISTS_ERROR,
            }),
        ],
        [
            DeleteUserError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.DELETE_USER_ERROR,
            }),
        ],
        [
            SoftwareTokenInitializationError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.SOFTWARE_TOKEN_INITIALIZATION_ERROR,
            }),
        ],
        [
            TokenStateError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.TOKEN_STATE_ERROR,
            }),
        ],
        [
            PIUnavailableError.name,
            new DbiamPrivacyIdeaAdministrationError({
                code: 400,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.PI_UNAVAILABLE_ERROR,
            }),
        ],
    ]);

    public catch(exception: TokenError, host: ArgumentsHost): void {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();

        const dbiamPersonError: DbiamPersonError = this.mapDomainErrorToDbiamError(exception);

        response.status(dbiamPersonError.code);
        response.json(dbiamPersonError);
    }

    private mapDomainErrorToDbiamError(error: TokenError): DbiamPersonError {
        return (
            this.ERROR_MAPPINGS.get(error.constructor.name) ??
            new DbiamPrivacyIdeaAdministrationError({
                code: 500,
                i18nKey: PrivacyIdeaAdministrationErrorI18nTypes.PRIVACY_IDEA_ADMINISTRATION_ERROR,
            })
        );
    }
}
