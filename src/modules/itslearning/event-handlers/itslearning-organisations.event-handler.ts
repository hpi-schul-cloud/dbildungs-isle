import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ItsLearningConfig } from '../../../shared/config/itslearning.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { DomainError } from '../../../shared/error/index.js';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { CreateGroupAction, CreateGroupParams } from '../actions/create-group.action.js';
import { GroupResponse, ReadGroupAction } from '../actions/read-group.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { KlasseCreatedEvent } from '../../../shared/events/klasse-created.event.js';

@Injectable()
export class ItsLearningOrganisationsEventHandler {
    public ENABLED: boolean;

    private readonly ROOT_OEFFENTLICH: string;

    private readonly ROOT_ERSATZ: string;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly itsLearningService: ItsLearningIMSESService,
        private readonly organisationRepository: OrganisationRepository,
        configService: ConfigService<ServerConfig>,
    ) {
        const itsLearningConfig: ItsLearningConfig = configService.getOrThrow<ItsLearningConfig>('ITSLEARNING');

        this.ENABLED = itsLearningConfig.ENABLED === 'true';

        this.ROOT_OEFFENTLICH = itsLearningConfig.ROOT_OEFFENTLICH;
        this.ROOT_ERSATZ = itsLearningConfig.ROOT_ERSATZ;
    }

    @EventHandler(SchuleCreatedEvent)
    public async createSchuleEventHandler(event: SchuleCreatedEvent): Promise<void> {
        this.logger.info(`Received CreateSchuleEvent, organisationId:${event.organisationId}`);

        if (!this.ENABLED) {
            this.logger.info('Not enabled, ignoring event.');
            return;
        }

        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(
            event.organisationId,
        );

        if (!organisation) {
            this.logger.error(`Organisation with id ${event.organisationId} could not be found!`);
            return;
        }

        if (organisation.typ === OrganisationsTyp.SCHULE) {
            const parent: OrganisationID | undefined = await this.findParentId(organisation);

            if (parent === this.ROOT_ERSATZ) {
                this.logger.error(`Ersatzschule, ignoring.`);
                return;
            }

            const params: CreateGroupParams = {
                id: organisation.id,
                name: `${organisation.kennung} (${organisation.name ?? 'Unbenannte Schule'})`,
                type: 'School',
                parentId: parent,
            };

            {
                // Check if school already exists in itsLearning
                const readAction: ReadGroupAction = new ReadGroupAction(organisation.id);
                const result: Result<GroupResponse, DomainError> = await this.itsLearningService.send(readAction);

                if (result.ok) {
                    // School already exists, keep relationship
                    params.parentId = result.value.parentId;
                }
            }

            const action: CreateGroupAction = new CreateGroupAction(params);

            const result: Result<void, DomainError> = await this.itsLearningService.send(action);

            if (!result.ok) {
                return this.logger.error(`Could not create Schule in itsLearning: ${result.error.message}`);
            }

            this.logger.info(`Schule with ID ${organisation.id} created.`);
        }
    }

    @EventHandler(KlasseCreatedEvent)
    public async createKlasseEventHandler(event: KlasseCreatedEvent): Promise<void> {
        this.logger.info(`Received KlasseCreatedEvent, ID: ${event.id}`);

        if (!this.ENABLED) {
            this.logger.info('Not enabled, ignoring event.');
            return;
        }

        if (!event.administriertVon) {
            return this.logger.error('Klasse has no parent organisation. Aborting.');
        }

        if (!event.name) {
            return this.logger.error('Klasse has no name. Aborting.');
        }

        {
            // Check if parent exists in itsLearning
            const readAction: ReadGroupAction = new ReadGroupAction(event.administriertVon);
            const result: Result<GroupResponse, DomainError> = await this.itsLearningService.send(readAction);

            if (!result.ok) {
                // Parent school does not exist
                return this.logger.error(
                    `Parent Organisation (${event.administriertVon}) does not exist in itsLearning.`,
                );
            }
        }

        const params: CreateGroupParams = {
            id: event.id,
            name: event.name,
            type: 'Course',
            parentId: event.administriertVon,
        };

        const action: CreateGroupAction = new CreateGroupAction(params);

        const result: Result<void, DomainError> = await this.itsLearningService.send(action);

        if (!result.ok) {
            return this.logger.error(`Could not create Klasse in itsLearning: ${result.error.message}`);
        }

        this.logger.info(`Klasse with ID ${event.id} created.`);
    }

    private async findParentId(organisation: Organisation<true>): Promise<OrganisationID> {
        const [oeffentlich, ersatz]: [Organisation<true> | undefined, Organisation<true> | undefined] =
            await this.organisationRepository.findRootDirectChildren();

        let parentOrgaId: OrganisationID | undefined = organisation.administriertVon;

        while (parentOrgaId) {
            const result: Option<Organisation<true>> = await this.organisationRepository.findById(parentOrgaId);

            if (result?.id === oeffentlich?.id) {
                return this.ROOT_OEFFENTLICH;
            } else if (result?.id === ersatz?.id) {
                return this.ROOT_ERSATZ;
            }

            parentOrgaId = result?.administriertVon;
        }

        return this.ROOT_OEFFENTLICH;
    }
}
