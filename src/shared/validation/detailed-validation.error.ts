import { BadRequestException, HttpExceptionOptions } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export class DetailedValidationError extends BadRequestException {
    public constructor(
        public readonly validationErrors: ValidationError[],
        objectOrError?: string | object | unknown,
        descriptionOrOptions?: string | HttpExceptionOptions,
    ) {
        super(objectOrError ? objectOrError : 'Bad Request Exception', descriptionOrOptions);
    }
}
