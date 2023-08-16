import { Module } from '@nestjs/common';
import { PersonApiMapperProfile } from './api/person-api.mapper.profile.js';
import { PersonController } from './api/person.controller.js';
import { PersonUc } from './api/person.uc.js';
import { PersonModule } from './person.module.js';
import { LoggerModule } from '../../core/logging/logger.module.js';

@Module({
    imports: [PersonModule, LoggerModule.register(PersonApiModule.name)],
    providers: [PersonApiMapperProfile, PersonUc],
    controllers: [PersonController],
})
export class PersonApiModule {}
