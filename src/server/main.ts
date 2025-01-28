/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { NestLogger } from '../core/logging/nest-logger.js';
import { FrontendConfig, HostConfig, KeycloakConfig, ServerConfig } from '../shared/config/index.js';
import { GlobalValidationPipe } from '../shared/validation/index.js';
import { ServerModule } from './server.module.js';
import { GlobalPagingHeadersInterceptor } from '../shared/paging/index.js';

async function bootstrap(): Promise<void> {
    const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(ServerModule);
    const configService: ConfigService<ServerConfig, true> = app.get(ConfigService<ServerConfig, true>);
    const backendHostname: string | undefined = configService.getOrThrow<HostConfig>('HOST').HOSTNAME;
    const port: number = configService.getOrThrow<HostConfig>('HOST').PORT;
    const keycloakConfig: KeycloakConfig = configService.getOrThrow<KeycloakConfig>('KEYCLOAK');

    const swagger: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
        .setTitle('dBildungs IAM')
        .setDescription('The dBildungs IAM server API description')
        .setVersion('1.0')
        .addOAuth2({
            type: 'oauth2',
            flows: {
                authorizationCode: {
                    authorizationUrl: `${keycloakConfig.EXTERNAL_BASE_URL}/realms/${keycloakConfig.REALM_NAME}/protocol/openid-connect/auth`,
                    tokenUrl: `${keycloakConfig.EXTERNAL_BASE_URL}/realms/${keycloakConfig.REALM_NAME}/protocol/openid-connect/token`,
                    refreshUrl: `${keycloakConfig.EXTERNAL_BASE_URL}/realms/${keycloakConfig.REALM_NAME}/protocol/openid-connect/token`,
                    scopes: {},
                },
            },
        })
        .addBearerAuth({
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        })
        .build();

    app.useLogger(app.get(NestLogger));
    app.useGlobalInterceptors(new GlobalPagingHeadersInterceptor());
    app.useGlobalPipes(new GlobalValidationPipe());
    app.setGlobalPrefix('api', {
        exclude: ['health', 'metrics', 'keycloakinternal/externaldata'],
    });

    let redirectUrl: string;
    if (backendHostname) {
        redirectUrl = `https://${backendHostname}/docs/oauth2-redirect.html`;
    } else {
        redirectUrl = `http://localhost:${port}/docs/oauth2-redirect.html`;
    }
    console.log('Envi: ' + process.env['DEPLOY_STAGE']);
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger), {
        swaggerOptions: {
            persistAuthorization: false,
            initOAuth: {
                clientId:
                    process.env['DEPLOY_STAGE'] === 'dev' ? keycloakConfig.TEST_CLIENT_ID : keycloakConfig.CLIENT_ID,
                clientSecret: keycloakConfig.CLIENT_SECRET,
                realm: keycloakConfig.REALM_NAME,
                usePkceWithAuthorizationCodeGrant: true,
                scopes: [],
            },
            oauth2RedirectUrl: redirectUrl,
        },
    });

    const frontendConfig: FrontendConfig = configService.getOrThrow<FrontendConfig>('FRONTEND');
    if (frontendConfig.TRUST_PROXY !== undefined) {
        app.set('trust proxy', frontendConfig.TRUST_PROXY);
    }

    await app.listen(port);

    console.info(`\nListening on: http://127.0.0.1:${port}`);
    console.info(`API documentation can be found on: http://127.0.0.1:${port}/docs`);
}

bootstrap().catch((error: unknown) => console.error('Failed to start server with error:', error));
