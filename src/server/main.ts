/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { HostConfig, ServerConfig } from '../shared/config/index.js';
import { GlobalValidationPipe } from '../core/validation/index.js';
import { ServerModule } from './server.module.js';
import { NestLogger } from '../core/logging/nest-logger.js';

async function bootstrap(): Promise<void> {
    const app: INestApplication = await NestFactory.create(ServerModule);
    app.useLogger(app.get(NestLogger));
    app.useGlobalPipes(new GlobalValidationPipe());
    const swagger: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
        .setTitle('dBildungs IAM')
        .setDescription('The dBildungs IAM server API description')
        .setVersion('1.0')
        .build();
    const configService: ConfigService<ServerConfig, true> = app.get(ConfigService<ServerConfig, true>);
    const port: number = configService.getOrThrow<HostConfig>('HOST').PORT;
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
    await app.listen(port);
    console.info(`\nListening on: http://127.0.0.1:${port}`);
    console.info(`API documentation can be found on: http://127.0.0.1:${port}/docs`);
}

bootstrap().catch((error: unknown) => console.error('Failed to start server with error:', error));
