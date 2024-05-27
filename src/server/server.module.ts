import { classes } from '@automapper/classes';
import { CamelCaseNamingConvention } from '@automapper/core';
import { AutomapperModule } from '@automapper/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { defineConfig } from '@mikro-orm/postgresql';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DbConfig, FrontendConfig, loadConfigFiles, RedisConfig, ServerConfig } from '../shared/config/index.js';
import { mappingErrorHandler } from '../shared/error/index.js';
import { PersonApiModule } from '../modules/person/person-api.module.js';
import { KeycloakAdministrationModule } from '../modules/keycloak-administration/keycloak-administration.module.js';
import { OrganisationApiModule } from '../modules/organisation/organisation-api.module.js';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from '../modules/health/health.module.js';
import { RolleApiModule } from '../modules/rolle/rolle-api.module.js';
import { LoggerModule } from '../core/logging/logger.module.js';
import { ErrorModule } from '../shared/error/error.module.js';
import { KeycloakConfigModule } from '../modules/keycloak-administration/keycloak-config.module.js';
import { AuthenticationApiModule } from '../modules/authentication/authentication-api.module.js';
import { PersonenKontextApiModule } from '../modules/personenkontext/personenkontext-api.module.js';
import { ServiceProviderApiModule } from '../modules/service-provider/service-provider-api.module.js';
import { SessionAccessTokenMiddleware } from '../modules/authentication/services/session-access-token.middleware.js';
import { createClient, RedisClientType } from 'redis';
import RedisStore from 'connect-redis';
import session from 'express-session';
import passport from 'passport';
import { ClassLogger } from '../core/logging/class-logger.js';
import { AccessGuard } from '../modules/authentication/api/access.guard.js';
import { PermissionsInterceptor } from '../modules/authentication/services/permissions.interceptor.js';
import { PassportModule } from '@nestjs/passport';
import { EventModule } from '../core/eventbus/index.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [loadConfigFiles],
        }),
        AutomapperModule.forRoot({
            strategyInitializer: classes(),
            namingConventions: new CamelCaseNamingConvention(),
            errorHandler: mappingErrorHandler,
        }),
        MikroOrmModule.forRootAsync({
            useFactory: (config: ConfigService<ServerConfig, true>) => {
                const dbConfig: DbConfig = config.getOrThrow<DbConfig>('DB');
                return defineConfig({
                    clientUrl: dbConfig.CLIENT_URL,
                    password: dbConfig.SECRET,
                    dbName: dbConfig.DB_NAME,
                    entities: ['./dist/**/*.entity.js'],
                    entitiesTs: ['./src/**/*.entity.ts'],
                    // Needed for HealthCheck
                    driverOptions: {
                        connection: {
                            ssl: dbConfig.USE_SSL,
                        },
                    },
                    connect: false,
                });
            },
            inject: [ConfigService],
        }),
        PassportModule.register({
            session: true,
            defaultStrategy: ['jwt', 'oidc'],
            keepSessionInfo: true,
            property: 'passportUser',
        }),
        LoggerModule.register(ServerModule.name),
        EventModule,
        AuthenticationApiModule,
        PersonApiModule,
        OrganisationApiModule,
        KeycloakAdministrationModule,
        HealthModule,
        RolleApiModule,
        ServiceProviderApiModule,
        PersonenKontextApiModule,
        ErrorModule,
        KeycloakConfigModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: AccessGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: PermissionsInterceptor,
        },
    ],
})
export class ServerModule implements NestModule {
    public constructor(
        private configService: ConfigService,
        private logger: ClassLogger,
    ) {}

    public async configure(consumer: MiddlewareConsumer): Promise<void> {
        const redisConfig: RedisConfig = this.configService.getOrThrow<RedisConfig>('REDIS');
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

        /*
        Just retrying does not work.
        Once the connection has failed if no error handler is registered later connection attempts might just fail because
        the client library assumes termination of the process if failure
        Also the documentation expressly requires listening to on('error')
         */

        /* istanbul ignore next */
        await redisClient
            .on('error', (error: Error) => this.logger.error(`Redis connection failed: ${error.message}`))
            .connect();
        this.logger.info('Redis-connection made');

        const redisStore: RedisStore = new RedisStore({
            client: redisClient,
        });

        consumer
            .apply(
                session({
                    store: redisStore,
                    resave: false,
                    saveUninitialized: false,
                    rolling: true,
                    cookie: {
                        maxAge: this.configService.getOrThrow<FrontendConfig>('FRONTEND').SESSION_TTL_MS,
                        secure: this.configService.getOrThrow<FrontendConfig>('FRONTEND').SECURE_COOKIE,
                    },
                    secret: this.configService.getOrThrow<FrontendConfig>('FRONTEND').SESSION_SECRET,
                }),
                passport.initialize({ userProperty: 'passportUser' }),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                passport.session(),
                SessionAccessTokenMiddleware,
            )
            .forRoutes('*');

        /*// configure LDAP connection
        const ldapConfig: LdapConfig = this.configService.getOrThrow<LdapConfig>('LDAP');
        const client: Client = new Client({
            url: ldapConfig.URL,
        });
        try {
            await client.bind(ldapConfig.BIND_DN, ldapConfig.PASSWORD);
            this.logger.info('Successfully connected to LDAP');

            // For test purposes, is connection working as expected?
              const entry: LdapPersonEntry = {
                cn: 'wwhite',
                sn: 'White',
                mail: ['walterwhite@walterwhiteltdco.com'],
                objectclass: ['person', 'inetOrgPerson', 'organizationalPerson'],
            };
            await client.add('cn=wwhite,ou=people,dc=example,dc=org', entry);
        } catch (err) {
            this.logger.error(`Could not connect to LDAP, message: ${JSON.stringify(err)}`);
        }*/
    }
}
