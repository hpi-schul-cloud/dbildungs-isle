import { Module } from '@nestjs/common';
import { ImportWorkflowFactory } from './domain/import-workflow.factory.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { ImportDataRepository } from './persistence/import-data.repository.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';

@Module({
    imports: [RolleModule, OrganisationModule, PersonenKontextModule],
    providers: [ImportWorkflowFactory, ImportDataRepository],
    exports: [ImportWorkflowFactory],
})
export class ImportModule {}
