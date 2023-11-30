/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { INestApplication, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import util from 'util';
import winston, { format } from 'winston';
import { localFormatter } from '../core/logging/module-logger.js';
import { NestLogger } from '../core/logging/nest-logger.js';
import { HostConfig, ServerConfig } from '../shared/config/index.js';
import { GlobalValidationPipe } from '../shared/validation/index.js';
import { ServerModule } from './server.module.js';
import { GlobalPagingHeadersInterceptor } from '../shared/paging/index.js';

class StartupLogger implements LoggerService {

    private logger: winston.Logger;

    localFormatter: (info: winston.Logform.TransformableInfo) => string = (
        info: winston.Logform.TransformableInfo,
    ) => {
        const message: string = typeof info.message === 'string' ? info.message : util.inspect(info.message);
        let context: string = 'Nest';
        let trace: string = '';
        let timestamp: string = '';
        let ms: string = '';

        if (typeof info['context'] === 'string') {
            context = info['context'];
        }

        if (typeof info['timestamp'] === 'string') {
            timestamp = info['timestamp'];
        }

        if (typeof info['ms'] === 'string') {
            ms = info['ms'];
        }

        if (typeof info['trace'] === 'string') {
            trace = `\n    ${info['trace']}`;
        }

        return `${info.level}\t ${timestamp} (${ms})\t \x1b[33m[${context}]\x1b[39m - ${message}${trace}`;
    };

    public constructor() {
        const loggerFormat: winston.Logform.Format = format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.ms(),
            format.colorize(),
            format.printf(localFormatter),
        );

        this.logger = winston.createLogger({
            format: loggerFormat,
            levels: winston.config.syslog.levels,
            exitOnError: false,
            handleExceptions: true,
            handleRejections: true,
            transports: [new winston.transports.Console()], // transport needs to be newly created here to not share log level with other loggers
        });
    }

    public debug(message: string): void {
        this.logger.debug(message);
    }

    public error(message: string): void {
        this.logger.error(message);
    }

    public info(message: string): void {
        this.logger.info(message);
    }

    public log(message: string): void {
        this.logger.info(message);
    }

    public trace(message: string): void {
        this.logger.info(message);
    }

    public warn(message: string): void {
        this.logger.warn(message);
    }
}

async function bootstrap(): Promise<void> {
    console.log('Very first line');
    const app: INestApplication = await NestFactory.create(ServerModule, { logger: new StartupLogger });
    console.log('after init');
    const configService: ConfigService<ServerConfig, true> = app.get(ConfigService<ServerConfig, true>);
    const port: number = configService.getOrThrow<HostConfig>('HOST').PORT;
    const swagger: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
        .setTitle('dBildungs IAM')
        .setDescription('The dBildungs IAM server API description')
        .setVersion('1.0')
        .build();

    app.useLogger(app.get(NestLogger));
    app.useGlobalInterceptors(new GlobalPagingHeadersInterceptor());
    app.useGlobalPipes(new GlobalValidationPipe());
    app.setGlobalPrefix('api', {
        exclude: ['health'],
    });

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

    await app.listen(port);

    console.info(`\nListening on: http://127.0.0.1:${port}`);
    console.info(`API documentation can be found on: http://127.0.0.1:${port}/docs`);
}

bootstrap().catch((error: unknown) => console.error('Failed to start server with error:', error));
