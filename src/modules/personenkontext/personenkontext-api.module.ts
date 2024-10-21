import { Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { PersonenkontextController } from '../personenkontext/api/personenkontext.controller.js';
import { PersonModule } from '../person/person.module.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { DBiamPersonenkontextController } from './api/dbiam-personenkontext.controller.js';
import { DbiamPersonenkontextWorkflowController } from './api/dbiam-personenkontext-workflow.controller.js';
import { EventModule } from '../../core/eventbus/index.js';
import { PersonAdministrationService } from './domain/person-administration.service.js';
import { PersonAdministrationController } from './api/person-administration.controller.js';
import { PersonApiMapper } from '../person/mapper/person-api.mapper.js';
import { PersonenKontextModule } from './personenkontext.module.js';

@Module({
    imports: [
        PersonenKontextModule,
        EventModule,
        PersonModule,
        RolleModule,
        OrganisationModule,
        LoggerModule.register(PersonenKontextApiModule.name),
    ],
    providers: [PersonAdministrationService, PersonApiMapper],
    controllers: [
        PersonenkontextController,
        DBiamPersonenkontextController,
        DbiamPersonenkontextWorkflowController,
        PersonAdministrationController,
    ],
})
export class PersonenKontextApiModule {}
