import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logging/logger.module.js';
import { ItsLearningOrganisationsEventHandler } from './event-handlers/itslearning-organisations.event-handler.js';
import { ItsLearningPersonsEventHandler } from './event-handlers/itslearning-persons.event-handler.js';
import { ItsLearningIMSESService } from './itslearning.service.js';

@Module({
    imports: [LoggerModule.register(ItsLearningModule.name), HttpModule],
    providers: [ItsLearningIMSESService, ItsLearningOrganisationsEventHandler, ItsLearningPersonsEventHandler],
    exports: [ItsLearningIMSESService],
})
export class ItsLearningModule {}
