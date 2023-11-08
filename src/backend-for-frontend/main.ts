/* eslint-disable no-console */
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import RedisStore from 'connect-redis';
import session from 'express-session';
import passport from 'passport';
import { RedisClientType, createClient } from 'redis';

import { FrontendConfig, RedisConfig, ServerConfig } from '../shared/config/index.js';
import { GlobalValidationPipe } from '../shared/validation/index.js';
import { BackendForFrontendModule } from './backend-for-frontend.module.js';

async function bootstrap(): Promise<void> {
    const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(BackendForFrontendModule);

    app.useGlobalPipes(new GlobalValidationPipe());
    const swagger: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
        .setTitle('dBildungs IAM')
        .setDescription('The dBildungs IAM server API description')
        .setVersion('1.0')
        .build();

    app.setGlobalPrefix('api', {
        exclude: ['health'],
    });
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

    const configService: ConfigService<ServerConfig, true> = app.get(ConfigService<ServerConfig, true>);
    const frontendConfig: FrontendConfig = configService.getOrThrow<FrontendConfig>('FRONTEND');
    const redisConfig: RedisConfig = configService.getOrThrow<RedisConfig>('REDIS');

    if (frontendConfig.TRUST_PROXY !== undefined) {
        app.set('trust proxy', frontendConfig.TRUST_PROXY);
    }

    const redisClient: RedisClientType = createClient({
        username: redisConfig.USERNAME,
        password: redisConfig.PASSWORD,
        socket: {
            host: redisConfig.HOST,
            port: redisConfig.PORT,
            tls: redisConfig.USE_TLS,
            key: redisConfig.PRIVATE_KEY,
            cert: redisConfig.CERTIFICATE_AUTHORITIES,
        },
    });
    await redisClient.connect();

    const redisStore: RedisStore = new RedisStore({
        client: redisClient,
    });

    app.use(
        session({
            store: redisStore,
            resave: false,
            saveUninitialized: false,
            rolling: true,
            cookie: {
                maxAge: frontendConfig.SESSION_TTL_MS,
                secure: frontendConfig.SECURE_COOKIE,
            },
            secret: frontendConfig.SESSION_SECRET,
        }),
    );

    app.use(passport.initialize());
    app.use(passport.session());

    const port: number = frontendConfig.PORT;
    await app.listen(port);

    console.info(`\nListening on: http://127.0.0.1:${port}`);
    console.info(`API documentation can be found on: http://127.0.0.1:${port}/docs`);
}

bootstrap().catch((error: unknown) => console.error('Failed to start server with error:', error));
