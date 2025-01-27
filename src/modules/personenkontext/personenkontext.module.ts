import { forwardRef, Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { PersonenkontextService } from '../personenkontext/domain/personenkontext.service.js';
import { PersonModule } from '../person/person.module.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { DBiamPersonenkontextService } from './domain/dbiam-personenkontext.service.js';
import { DbiamPersonenkontextFactory } from './domain/dbiam-personenkontext.factory.js';
import { EventModule } from '../../core/eventbus/index.js';
import { PersonenkontextPersistenceModule } from './persistence/PersonenkontextPersistenceModule.js';
import { PersonenkontextCreationService } from './domain/personenkontext-creation.service.js';
import { PersonenkontextWorkflowFactory } from './domain/personenkontext-workflow.factory.js';
import { PersonenkontextRepo } from './persistence/personenkontext.repo.js';
import { DBiamPersonenkontextRepo } from './persistence/dbiam-personenkontext.repo.js';
import { DBiamPersonenkontextRepoInternal } from './persistence/internal-dbiam-personenkontext.repo.js';
import { PersonenkontextFactory } from './domain/personenkontext.factory.js';
import { PersonenkontextSpecificationsModule } from './specification/personenkontext-specification.module.js';

@Module({
    imports: [
        EventModule,
        forwardRef(() => PersonModule),
        RolleModule,
        OrganisationModule,
        PersonenkontextSpecificationsModule,
        PersonenkontextPersistenceModule,
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
        DBiamPersonenkontextService,
        DbiamPersonenkontextFactory,
        PersonenkontextPersistenceModule,
        PersonenkontextSpecificationsModule,
        PersonenkontextCreationService,
        PersonenkontextWorkflowFactory,
    ],
})
export class PersonenKontextModule {}
