import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { Response } from 'express';
import util from 'util';
import { DetailedValidationError } from '../../core/validation/detailed-validation.error.js';
import { ValidationError } from 'class-validator';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/index.js';
import { SchulConnexError } from './schul-connex-error.js';

@Catch(DetailedValidationError)
export class SchulConnexValidationErrorFilter implements ExceptionFilter<DetailedValidationError> {
    public constructor(private logger: ClassLogger) {}

    public catch(exception: DetailedValidationError, host: ArgumentsHost): void {
        this.logger.debug(util.inspect(exception));

        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();

        const schulConnexError: Omit<SchulConnexError, 'statusCode'> = this.handleValidationError(exception);

        response.status(400).json({
            statusCode: 400,
            ...schulConnexError,
        });
    }

    private handleValidationError(validationError: DetailedValidationError): Omit<SchulConnexError, 'statusCode'> {
        const validationErrors: ValidationError[] = validationError.validationErrors;

        if (validationErrors.length < 1 || !validationErrors[0])
            return { subcode: '00', title: 'Fehlerhafte Anfrage', description: 'Die Anfrage ist fehlerhaft' };

        let currentError: ValidationError = validationErrors[0];
        let propertyPath: string = currentError.property;
        while (currentError?.children?.length && currentError.children[0]) {
            currentError = currentError.children[0];
            propertyPath = `${propertyPath}.${currentError.property}`;
        }
        if (currentError.constraints) {
            if (currentError?.constraints['isDate']) {
                return {
                    subcode: '09',
                    title: 'Datumsattribut hat einen ungültigen Wert',
                    description: `Datumsformat von Attribut ${propertyPath} ist ungültig`,
                };
            }
        }
        return { subcode: '00', title: 'Fehlerhafte Anfrage', description: 'Die Anfrage ist fehlerhaft' };
    }
}
