import { OxError } from '../../../shared/error/ox.error.js';
import { OxErrorResponse } from '../actions/ox-base-action.js';
import { OxUsernameAlreadyExistsError } from '../error/ox-username-already-exists.error.js';
import { OxDisplaynameAlreadyUsedError } from '../error/ox-displayname-already-used.error.js';
import { OxPrimaryMailAlreadyExistsError } from '../error/ox-primary-mail-already-exists.error.js';
import { OxPrimaryMailNotEqualEmail1Error } from '../error/ox-primary-mail-not-equal-email1.error.js';

export class OxErrorMapper {
    private static readonly USERNAME_ALREADY_EXISTS_REGEX: RegExp =
        /^User [A-Za-z0-9]* already exists in this context; exceptionId [\w\d-]*/;

    private static readonly DISPLAYNAME_ALDREADY_USED_REGEX: RegExp = /^The displayname is already used;[.]*/;

    private static readonly PRIMARY_MAIL_ADDRESS_ALREADY_EXISTS_REGEX: RegExp =
        /^Primary mail address \"[\w\d@\-\.]*\" already exists in context[.]*/;

    private static readonly PRIMARY_MAIL_ADDRESS_HAS_TO_EQUAL_EMAIL1_REGEX: RegExp =
        /^primarymail must have the same value as email1;[.]*/;

    public static mapOxErrorResponseToOxError(oxErrorResponse: OxErrorResponse): OxError {
        const faultString: string = oxErrorResponse.Envelope.Body.Fault.faultstring;

        if (OxErrorMapper.USERNAME_ALREADY_EXISTS_REGEX.test(faultString))
            return new OxUsernameAlreadyExistsError(faultString);
        if (OxErrorMapper.DISPLAYNAME_ALDREADY_USED_REGEX.test(faultString))
            return new OxDisplaynameAlreadyUsedError(faultString);
        if (OxErrorMapper.PRIMARY_MAIL_ADDRESS_ALREADY_EXISTS_REGEX.test(faultString))
            return new OxPrimaryMailAlreadyExistsError(faultString);
        if (OxErrorMapper.PRIMARY_MAIL_ADDRESS_HAS_TO_EQUAL_EMAIL1_REGEX.test(faultString))
            return new OxPrimaryMailNotEqualEmail1Error(faultString);

        return new OxError();
    }
}
