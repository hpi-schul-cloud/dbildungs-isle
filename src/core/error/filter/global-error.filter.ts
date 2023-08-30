import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpArgumentsHost, ValidationError } from '@nestjs/common/interfaces';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import util from 'util';
import { ClassLogger } from '../../logging/class-logger.js';
import { SchulConnexError } from '../../../shared/error/schul-connex-error.js';
import { DetailedValidationError } from '../../validation/detailed-validation.error.js';

type ErrorDescription = Omit<SchulConnexError, 'statusCode' | 'subcode'>;

const internalServerErrorDescription: ErrorDescription = {
    title: 'Interner Serverfehler',
    description: 'Es ist ein interner Fehler aufgetreten',
};

const errorMessageMap: Map<number, ErrorDescription> = new Map();
errorMessageMap.set(400, { title: 'Fehlerhafte Anfrage“', description: 'Die Anfrage ist fehlerhaft' });
errorMessageMap.set(401, {
    title: 'Zugang verweigert',
    description: 'Die Anfrage konnte aufgrund fehlender Autorisierung nicht verarbeitet werden.',
});
errorMessageMap.set(403, {
    title: 'Fehlende Rechte',
    description:
        'Die Autorisierung war erfolgreich, aber die erforderlichen Rechte für die Nutzung dieses Endpunktes sind nicht vorhanden.',
});
errorMessageMap.set(404, {
    title: 'Endpunkt existiert nicht',
    description: 'Der aufgerufene Endpunkt existiert nicht',
});
errorMessageMap.set(500, internalServerErrorDescription);

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public constructor(private readonly httpAdapterHost: HttpAdapterHost, private logger: ClassLogger) {}

    public catch(exception: unknown, host: ArgumentsHost): void {
        // In certain situations `httpAdapter` might not be available in the
        // constructor method, thus we should resolve it here.
        const { httpAdapter }: { httpAdapter: AbstractHttpAdapter } = this.httpAdapterHost;

        const ctx: HttpArgumentsHost = host.switchToHttp();

        if (exception instanceof DetailedValidationError) {
            this.logger.error(exception.message, exception.stack);
            const responseBody: SchulConnexError = this.handleValidationError(exception);
            httpAdapter.reply(ctx.getResponse(), responseBody, responseBody.statusCode);
        } else if (exception instanceof Error) {
            const httpStatus: number =
                exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

            if (Math.floor(httpStatus / 100) === 4) {
                this.logger.error(exception.message, exception.stack);
            } else {
                this.logger.crit(exception.message, exception.stack);
            }
            const errorDescription: ErrorDescription = errorMessageMap.get(httpStatus) || {
                title: 'Unbekannter Fehler',
                description: 'Es ist ein unbekannter Fehler aufgetreten',
            };
            const responseBody: SchulConnexError = {
                subcode: '00',
                statusCode: httpStatus,
                ...errorDescription,
            };
            httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
        } else {
            this.logger.alert(`UNEXPECTED EXCEPTION - no instance of Error: ${util.inspect(exception)}`);
            const responseBody: SchulConnexError = {
                statusCode: 500,
                subcode: '00',
                ...internalServerErrorDescription,
            };

            httpAdapter.reply(ctx.getResponse(), responseBody, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private handleValidationError(validationError: DetailedValidationError): SchulConnexError {
        const validationErrors: ValidationError[] = validationError.validationErrors;

        if (validationErrors.length < 1 || !validationErrors[0])
            return {
                statusCode: 400,
                subcode: '00',
                title: 'Fehlerhafte Anfrage',
                description: 'Die Anfrage ist fehlerhaft',
            };

        let currentError: ValidationError = validationErrors[0];
        let propertyPath: string = currentError.property;
        while (currentError?.children?.length && currentError.children[0]) {
            currentError = currentError.children[0];
            propertyPath = `${propertyPath}.${currentError.property}`;
        }
        if (currentError.constraints) {
            // TODO handle other validation errors
            if (currentError?.constraints['isDate']) {
                return {
                    statusCode: 400,
                    subcode: '09',
                    title: 'Datumsattribut hat einen ungültigen Wert',
                    description: `Datumsformat von Attribut ${propertyPath} ist ungültig`,
                };
            }
        }
        return {
            statusCode: 400,
            subcode: '00',
            title: 'Fehlerhafte Anfrage',
            description: 'Die Anfrage ist fehlerhaft',
        };
    }
}
