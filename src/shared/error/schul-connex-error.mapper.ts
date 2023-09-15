import { EntityNotFoundError } from './entity-not-found.error.js';
import { SchulConnexError } from './schul-connex-error.js';
import { DomainError } from './domain.error.js';
import { HttpException, Injectable } from "@nestjs/common";

@Injectable()
export class SchulConnexErrorMapper {

    public static mapSchulConnexErrorToHttpExcetion(scError: SchulConnexError): HttpException {
        const exception: HttpException = new HttpException(scError,scError.statusCode);
        return exception;
    }

    public static mapDomainErrorToSchulConnexError(error: DomainError): SchulConnexError {
        let schulconnexError: SchulConnexError = {
            statusCode: 500,
            subcode: '00',
            title: 'Interner Serverfehler',
            description: 'Es ist ein interner Fehler aufgetreten. Der aufgetretene Fehler konnte nicht verarbeitet werden',
        };
        if (error instanceof EntityNotFoundError) {
            schulconnexError = this.mapEntityNotFound();
        }
        return schulconnexError;
    }

    private static mapEntityNotFound(): SchulConnexError {
        const schulConnexError: SchulConnexError = {
            statusCode: 404,
            subcode: '01',
            title: 'Angefragte Entität existiert nicht',
            description: 'Die angeforderte Entität existiert nicht',
        }
        return schulConnexError;
    }
}
