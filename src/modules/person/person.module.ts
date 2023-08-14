import { Module } from '@nestjs/common';
import { PersonService } from './domain/person.service.js';
import { PersonPersistenceMapperProfile } from './persistence/person-persistence.mapper.profile.js';
import { PersonRepo } from './persistence/person.repo.js';
import { moduleProviderFactory } from '../../core/logging/module-logger-factory.js';

@Module({
    providers: [PersonPersistenceMapperProfile, PersonRepo, PersonService, moduleProviderFactory(PersonModule.name)],
    exports: [PersonService],
})
export class PersonModule {}
