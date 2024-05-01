import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logging/logger.module.js';
import { DbSeedService } from './domain/db-seed.service.js';
import { DbSeedMapper } from './db-seed-mapper.js';
import { DbSeedConsole } from './db-seed.console.js';
import { PersonModule } from '../../modules/person/person.module.js';
import { PersonenKontextModule } from '../../modules/personenkontext/personenkontext.module.js';
import { OrganisationModule } from '../../modules/organisation/organisation.module.js';
import { RolleModule } from '../../modules/rolle/rolle.module.js';
import { ServiceProviderModule } from '../../modules/service-provider/service-provider.module.js';
import { KeycloakAdministrationModule } from '../../modules/keycloak-administration/keycloak-administration.module.js';
import { DbSeedRepo } from './repo/db-seed.repo.js';
import { DBiamPersonenkontextRepo } from '../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { DbSeedReferenceRepo } from './repo/db-seed-reference.repo.js';

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
    providers: [DbSeedService, DbSeedMapper, DbSeedConsole, DBiamPersonenkontextRepo, DbSeedRepo, DbSeedReferenceRepo],
    exports: [DbSeedService, DbSeedMapper, DbSeedConsole, DbSeedRepo],
})
export class DbSeedModule {}
