import { Module } from '@nestjs/common';
import { PersonApiMapperProfile } from './api/person-api.mapper.profile.js';
import { PersonController } from './api/person.controller.js';
import { PersonUc } from './api/person.uc.js';
import { PersonModule } from './person.module.js';
import { moduleProviderFactory } from '../../core/logging/module-logger-factory.js';
import { DummyController } from './api/dummy.controller.js';

@Module({
    imports: [PersonModule],
    providers: [PersonApiMapperProfile, PersonUc, moduleProviderFactory(PersonApiModule.name)],
    controllers: [PersonController, DummyController],
})
export class PersonApiModule {}
