import { Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logging/logger.module.js';

import { PersonController } from './api/person.controller.js';
import { PersonModule } from './person.module.js';
import { PersonFrontendController } from './api/person.frontend.controller.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { KeycloakAdministrationModule } from '../keycloak-administration/keycloak-administration.module.js';
import { DBiamPersonenuebersichtController } from './api/personenuebersicht/dbiam-personenuebersicht.controller.js';
import { PersonInfoController } from './api/person-info.controller.js';
import { PersonApiMapper } from './mapper/person-api.mapper.js';
import { PersonDeleteModule } from './person-deletion/person-delete.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
    imports: [
        PersonModule,
        EmailModule,
        RolleModule,
        OrganisationModule,
        PersonenKontextModule,
        PersonDeleteModule,
        KeycloakAdministrationModule,
        LoggerModule.register(PersonApiModule.name),
    ],
    providers: [PersonApiMapper],
    controllers: [PersonController, PersonFrontendController, DBiamPersonenuebersichtController, PersonInfoController],
})
export class PersonApiModule {}
