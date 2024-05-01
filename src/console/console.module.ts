import { CamelCaseNamingConvention } from '@automapper/core';
import { classes } from '@automapper/classes';
import { AutomapperModule } from '@automapper/nestjs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { defineConfig } from '@mikro-orm/postgresql';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DbConfig, loadConfigFiles, ServerConfig } from '../shared/config/index.js';
import { mappingErrorHandler } from '../shared/error/index.js';
import { DbConsole } from './db.console.js';
import { DbInitConsole } from './db-init.console.js';
import { LoggerModule } from '../core/logging/logger.module.js';
import { KeycloakAdministrationModule } from '../modules/keycloak-administration/keycloak-administration.module.js';
import { UsernameGeneratorService } from '../modules/person/domain/username-generator.service.js';
import { KeycloakConfigModule } from '../modules/keycloak-administration/keycloak-config.module.js';
import { OrganisationModule } from '../modules/organisation/organisation.module.js';
import { RolleModule } from '../modules/rolle/rolle.module.js';
import { ServiceProviderModule } from '../modules/service-provider/service-provider.module.js';
import { PersonModule } from '../modules/person/person.module.js';
import { PersonenKontextModule } from '../modules/personenkontext/personenkontext.module.js';
import { DbSeedConsole } from './dbseed/db-seed.console.js';
import { DbSeedModule } from './dbseed/db-seed.module.js';

@Module({
    imports: [
        OrganisationModule,
        KeycloakConfigModule,
        KeycloakAdministrationModule,
        PersonModule,
        RolleModule,
        ServiceProviderModule,
        PersonenKontextModule,
        DbSeedModule,
        LoggerModule.register(ConsoleModule.name),
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
                return defineConfig({
                    clientUrl: config.getOrThrow<DbConfig>('DB').CLIENT_URL,
                    dbName: config.getOrThrow<DbConfig>('DB').DB_NAME,
                    password: config.getOrThrow<DbConfig>('DB').SECRET,
                    entities: ['./dist/**/*.entity.js'],
                    entitiesTs: ['./src/**/*.entity.ts'],
                    driverOptions: {
                        connection: {
                            ssl: config.getOrThrow<DbConfig>('DB').USE_SSL,
                        },
                    },
                    allowGlobalContext: true,
                    connect: false,
                });
            },
            inject: [ConfigService],
        }),
    ],
    providers: [DbConsole, DbInitConsole, DbSeedConsole, UsernameGeneratorService],
})
export class ConsoleModule {}
