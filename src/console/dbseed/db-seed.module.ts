import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logging/logger.module.js';
import { DbSeedService } from './db-seed.service.js';
import { DbSeedMapper } from './db-seed-mapper.js';
import { DbSeedConsole } from './db-seed.console.js';
import { PersonModule } from '../../modules/person/person.module.js';
import { PersonenKontextModule } from '../../modules/personenkontext/personenkontext.module.js';
import { OrganisationModule } from '../../modules/organisation/organisation.module.js';
import { RolleModule } from '../../modules/rolle/rolle.module.js';
import { ServiceProviderModule } from '../../modules/service-provider/service-provider.module.js';
import { KeycloakAdministrationModule } from '../../modules/keycloak-administration/keycloak-administration.module.js';

@Module({
    imports: [
        PersonModule,
        PersonenKontextModule,
        OrganisationModule,
        RolleModule,
        ServiceProviderModule,
        KeycloakAdministrationModule,
        LoggerModule.register(DbSeedModule.name),
    ],
    providers: [DbSeedService, DbSeedMapper, DbSeedConsole],
    exports: [DbSeedService, DbSeedMapper, DbSeedConsole],
})
export class DbSeedModule {}
