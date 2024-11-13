import { Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { PersonenkontextRepo } from '../personenkontext/persistence/personenkontext.repo.js';
import { PersonenkontextService } from '../personenkontext/domain/personenkontext.service.js';
import { PersonModule } from '../person/person.module.js';
import { DBiamPersonenkontextRepo } from './persistence/dbiam-personenkontext.repo.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { DBiamPersonenkontextService } from './domain/dbiam-personenkontext.service.js';
import { DbiamPersonenkontextFactory } from './domain/dbiam-personenkontext.factory.js';
import { PersonenkontextFactory } from './domain/personenkontext.factory.js';
import { EventModule } from '../../core/eventbus/index.js';
import { DBiamPersonenkontextRepoInternal } from './persistence/internal-dbiam-personenkontext.repo.js';
import { PersonenkontextCreationService } from './domain/personenkontext-creation.service.js';
import { PersonenkontextWorkflowFactory } from './domain/personenkontext-workflow.factory.js';

@Module({
    imports: [
        EventModule,
        PersonModule,
        RolleModule,
        OrganisationModule,
        LoggerModule.register(PersonenKontextModule.name),
    ],
    providers: [
        PersonenkontextRepo,
        PersonenkontextService,
        DBiamPersonenkontextService,
        DBiamPersonenkontextRepo,
        DBiamPersonenkontextRepoInternal,
        DbiamPersonenkontextFactory,
        PersonenkontextFactory,
        PersonenkontextCreationService,
        PersonenkontextWorkflowFactory,
    ],
    exports: [
        PersonenkontextService,
        PersonenkontextRepo,
        DBiamPersonenkontextService,
        DBiamPersonenkontextRepo,
        DbiamPersonenkontextFactory,
        DBiamPersonenkontextRepoInternal, // TODO: Needed by seeding
        PersonenkontextFactory,
        PersonenkontextCreationService,
        PersonenkontextWorkflowFactory,
    ],
})
export class PersonenKontextModule {}
