import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import util from 'util';
import { ClassLogger } from '../../logging/class-logger.js';

type ErrorDto = {
    message: string;
    statusCode: number;
    timestamp: string;
    path: unknown;
};

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
    public constructor(private readonly httpAdapterHost: HttpAdapterHost, private logger: ClassLogger) {}

    public catch(exception: unknown, host: ArgumentsHost): void {
        // In certain situations `httpAdapter` might not be available in the
        // constructor method, thus we should resolve it here.
        const { httpAdapter }: { httpAdapter: AbstractHttpAdapter } = this.httpAdapterHost;

        const ctx: HttpArgumentsHost = host.switchToHttp();

        if (exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
            const httpStatus: number =
                exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

            const responseBody: ErrorDto = {
                message: exception.message,
                statusCode: httpStatus,
                timestamp: new Date().toISOString(),
                path: httpAdapter.getRequestUrl(ctx.getRequest()),
            };
            httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
        } else {
            this.logger.alert(`UNEXPECTED EXCEPTION - no instance of Error: ${util.inspect(exception)}`);
            const responseBody: ErrorDto = {
                message: 'an unknown exception occured',
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                timestamp: new Date().toISOString(),
                path: httpAdapter.getRequestUrl(ctx.getRequest()),
            };

            httpAdapter.reply(ctx.getResponse(), responseBody, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
