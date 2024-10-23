import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PersonModule } from '../person/person.module.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';
import { ServiceProviderModule } from '../service-provider/service-provider.module.js';
import { PrivacyIdeaAdministrationController } from './privacy-idea-administration.controller.js';
import { PrivacyIdeaAdministrationService } from './privacy-idea-administration.service.js';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { PrivacyIdeaAdministrationEventHandler } from './privacy-idea-administration-event-handler.js';

@Module({
    imports: [
        HttpModule,
        PersonModule,
        PersonenKontextModule,
        ServiceProviderModule,
        LoggerModule.register(PrivacyIdeaAdministrationModule.name),
    ],
    controllers: [PrivacyIdeaAdministrationController],
    providers: [PrivacyIdeaAdministrationService, PrivacyIdeaAdministrationEventHandler],
})
export class PrivacyIdeaAdministrationModule {}
