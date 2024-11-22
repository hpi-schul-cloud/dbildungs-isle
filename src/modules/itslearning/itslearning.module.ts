import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logging/logger.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { PersonModule } from '../person/person.module.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { ItsLearningOrganisationsEventHandler } from './event-handlers/itslearning-organisations.event-handler.js';
import { ItsLearningPersonsEventHandler } from './event-handlers/itslearning-persons.event-handler.js';
import { ItsLearningSyncEventHandler } from './event-handlers/itslearning-sync.event-handler.js';
import { ItsLearningIMSESService } from './itslearning.service.js';
import { ItslearningGroupRepo } from './repo/itslearning-group.repo.js';
import { ItslearningMembershipRepo } from './repo/itslearning-membership.repo.js';
import { ItslearningPersonRepo } from './repo/itslearning-person.repo.js';

@Module({
    imports: [
        LoggerModule.register(ItsLearningModule.name),
        HttpModule,
        PersonModule,
        RolleModule,
        OrganisationModule,
        PersonenKontextModule,
    ],
    providers: [
        ItsLearningIMSESService,
        ItslearningPersonRepo,
        ItslearningGroupRepo,
        ItslearningMembershipRepo,
        ItsLearningOrganisationsEventHandler,
        ItsLearningPersonsEventHandler,
        ItsLearningSyncEventHandler,
    ],
    exports: [ItsLearningIMSESService],
})
export class ItsLearningModule {}
