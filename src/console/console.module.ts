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
import { Migrator, TSMigrationGenerator } from '@mikro-orm/migrations';
import { DbInitMigrationConsole } from './dbmigrate/db-init-migration.console.js';
import { DbCreateMigrationConsole } from './dbmigrate/db-create-migration.console.js';
import { DbApplyMigrationConsole } from './dbmigrate/db-apply-migration.console.js';
import { LdapModule } from '../core/ldap/ldap.module.js';
import { DbSeedDataGeneratorConsole } from './dbseed/db-seed-data-generator.console.js';
import { KeycloakConsoleModule } from './keycloak/keycloak-console.module.js';

@Module({
    imports: [
        OrganisationModule,
        KeycloakConfigModule,
        KeycloakAdministrationModule,
        PersonModule,
        RolleModule,
        ServiceProviderModule,
        PersonenKontextModule,
        LdapModule,
        DbSeedModule,
        KeycloakConsoleModule,
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
                    user: config.getOrThrow<DbConfig>('DB').USERNAME,
                    password: config.getOrThrow<DbConfig>('DB').SECRET,
                    entities: ['./dist/**/*.entity.js'],
                    entitiesTs: ['./src/**/*.entity.ts'],
                    extensions: [Migrator],
                    migrations: {
                        tableName: 'mikro_orm_migrations', // name of database table with log of executed transactions
                        path: './dist/migrations', // path to the folder with migrations
                        pathTs: './migrations', // path to the folder with TS migrations (if used, you should put path to compiled files in `path`)
                        glob: '!(*.d).{js,ts}', // how to match migration files (all .js and .ts files, but not .d.ts)
                        transactional: true, // wrap each migration in a transaction
                        disableForeignKeys: false, // wrap statements with `set foreign_key_checks = 0` or equivalent
                        allOrNothing: true, // wrap all migrations in master transaction
                        dropTables: true, // allow to disable table dropping
                        safe: false, // allow to disable table and column dropping
                        snapshot: true, // save snapshot when creating new migrations
                        emit: 'ts', // migration generation mode
                        generator: TSMigrationGenerator, // migration generator, e.g. to allow custom formatting
                    },
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
    providers: [
        DbConsole,
        DbInitConsole,
        DbSeedConsole,
        DbInitMigrationConsole,
        DbCreateMigrationConsole,
        DbApplyMigrationConsole,
        UsernameGeneratorService,
        DbSeedDataGeneratorConsole,
    ],
})
export class ConsoleModule {}
