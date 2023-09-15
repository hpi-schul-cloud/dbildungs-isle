import { ClassLogger } from '../../core/logging/class-logger.js';
import { createMock } from '@golevelup/ts-jest';
import { SchulConnexValidationErrorFilter } from './schulconnex-validation-error.filter.js';
import { ArgumentsHost } from '@nestjs/common';
import { DetailedValidationError } from '../../core/validation/detailed-validation.error.js';
import { Response } from 'express';

describe('SchulConnexValidationErrorFilter', () => {
    let classLogger: ClassLogger;
    let filter: SchulConnexValidationErrorFilter;

    beforeEach(() => {
        classLogger = createMock<ClassLogger>();
        filter = new SchulConnexValidationErrorFilter(classLogger);
    });

    it('should pass along the error as a http response', () => {
        const host = createMock<ArgumentsHost>();
        const exception: DetailedValidationError = new DetailedValidationError([]);

        const response = createMock<Response<string, Record<string, string>>>();
        response.status = jest.fn((code: number) => {
            expect(code).toBe(400);
            return response;
        });
        response.json = jest.fn((body?: string) => {
            expect(body).toBeDefined();
            expect(body).toStrictEqual({
                description: 'Die Anfrage ist fehlerhaft',
                statusCode: 400,
                subcode: '00',
                title: 'Fehlerhafte Anfrage',
            });
            return response;
        });
        host.switchToHttp().getResponse.mockReturnValue(response);

        filter.catch(exception, host);

        expect(host.switchToHttp).toBeCalled();
        expect(host.switchToHttp().getResponse).toBeCalled();
        expect(response.json).toBeCalled();
    });
});
