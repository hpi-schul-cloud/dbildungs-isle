import { Injectable } from '@nestjs/common';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { ImportWorkflow } from './import-workflow.js';
import { ImportDataRepository } from '../persistence/import-data.repository.js';
import { PersonenkontextCreationService } from '../../personenkontext/domain/personenkontext-creation.service.js';

@Injectable()
export class ImportWorkflowFactory {
    public constructor(
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepository: OrganisationRepository,
        private readonly importDataRepository: ImportDataRepository,
        private readonly personenkontextCreationService: PersonenkontextCreationService,
    ) {}

    public createNew(): ImportWorkflow {
        return ImportWorkflow.createNew(
            this.rolleRepo,
            this.organisationRepository,
            this.importDataRepository,
            this.personenkontextCreationService,
        );
    }
}
