import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ItsLearningConfig } from '../../../shared/config/itslearning.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { DomainError } from '../../../shared/error/index.js';
import { KlasseCreatedEvent } from '../../../shared/events/klasse-created.event.js';
import { KlasseDeletedEvent } from '../../../shared/events/klasse-deleted.event.js';
import { KlasseUpdatedEvent } from '../../../shared/events/klasse-updated.event.js';
import { OrganisationsTyp, RootDirectChildrenType } from '../../organisation/domain/organisation.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { CreateGroupParams } from '../actions/create-group.params.js';
import { UpdateGroupParams } from '../actions/update-group.action.js';
import { ItslearningGroupRepo } from '../repo/itslearning-group.repo.js';
import { SchuleItslearningEnabledEvent } from '../../../shared/events/schule-itslearning-enabled.event.js';

@Injectable()
export class ItsLearningOrganisationsEventHandler {
    public ENABLED: boolean;

    public readonly ROOT_OEFFENTLICH: string;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly organisationRepo: OrganisationRepository,
        private readonly itslearningGroupRepo: ItslearningGroupRepo,
        configService: ConfigService<ServerConfig>,
    ) {
        const itsLearningConfig: ItsLearningConfig = configService.getOrThrow<ItsLearningConfig>('ITSLEARNING');

        this.ENABLED = itsLearningConfig.ENABLED === 'true';

        this.ROOT_OEFFENTLICH = itsLearningConfig.ROOT_OEFFENTLICH;
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
            // Check if parent is an itslearning schule
            const parent: Option<Organisation<true>> = await this.organisationRepo.findById(event.administriertVon);
            if (!parent?.itslearningEnabled) {
                return this.logger.info(
                    `Parent Organisation (${event.administriertVon}) is not an itslearning schule.`,
                );
            }
        }

        const params: CreateGroupParams = {
            id: event.id,
            name: event.name,
            type: 'Unspecified',
            parentId: event.administriertVon,
        };

        const createError: Option<DomainError> = await this.itslearningGroupRepo.createOrUpdateGroup(params);

        if (createError) {
            return this.logger.error(`Could not create Klasse in itsLearning: ${createError.message}`);
        }

        this.logger.info(`Klasse with ID ${event.id} created.`);
    }

    @EventHandler(KlasseUpdatedEvent)
    public async updatedKlasseEventHandler(event: KlasseUpdatedEvent): Promise<void> {
        this.logger.info(`Received KlasseUpdatedEvent, ID: ${event.organisationId}, new name: ${event.name}`);

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
            // Check if parent is an itslearning schule
            const parent: Option<Organisation<true>> = await this.organisationRepo.findById(event.administriertVon);
            if (!parent?.itslearningEnabled) {
                return this.logger.info(
                    `Parent Organisation (${event.administriertVon}) is not an itslearning schule.`,
                );
            }
        }

        const params: UpdateGroupParams = {
            id: event.organisationId,
            name: event.name,
            type: 'Unspecified',
            parentId: event.administriertVon,
        };

        const createError: Option<DomainError> = await this.itslearningGroupRepo.createOrUpdateGroup(params);

        if (createError) {
            return this.logger.error(`Could not update Klasse in itsLearning: ${createError.message}`);
        }

        this.logger.info(`Klasse with ID ${event.organisationId} was updated.`);
    }

    @EventHandler(KlasseDeletedEvent)
    public async deletedKlasseEventHandler(event: KlasseDeletedEvent): Promise<void> {
        this.logger.info(`Received KlasseUpdatedEvent, ID: ${event.organisationId}`);

        if (!this.ENABLED) {
            this.logger.info('Not enabled, ignoring event.');
            return;
        }

        const deleteError: Option<DomainError> = await this.itslearningGroupRepo.deleteGroup(event.organisationId);

        if (deleteError) {
            return this.logger.error(`Could not delete Klasse in itsLearning: ${deleteError.message}`);
        }

        this.logger.info(`Klasse with ID ${event.organisationId} was deleted.`);
    }

    @EventHandler(SchuleItslearningEnabledEvent)
    public async schuleItslearningEnabledEventHandler(event: SchuleItslearningEnabledEvent): Promise<void> {
        this.logger.info(`Received EnableSchuleItslearningEvent, ID: ${event.organisationId}`);

        if (!this.ENABLED) {
            this.logger.info('Not enabled, ignoring event.');
            return;
        }

        if (event.typ !== OrganisationsTyp.SCHULE) {
            this.logger.error(`The organisation with ID ${event.organisationId} is not of type "SCHULE"!`);
            return;
        }

        const [rootType, klassen]: [RootDirectChildrenType, Organisation<true>[]] = await Promise.all([
            this.organisationRepo.findOrganisationZuordnungErsatzOderOeffentlich(event.organisationId),
            this.organisationRepo.findChildOrgasForIds([event.organisationId]),
        ]);

        if (rootType === RootDirectChildrenType.ERSATZ) {
            this.logger.error('Ersatzschule, ignoring.');
            return;
        }

        // Create params for all klassen
        const createParams: CreateGroupParams[] = klassen
            .filter((k: Organisation<true>) => k.typ === OrganisationsTyp.KLASSE)
            .map((o: Organisation<true>) => ({
                id: o.id,
                name: o.name || 'Unbenannte Klasse',
                type: 'Unspecified',
                parentId: event.organisationId,
            }));

        // Prepend the params for the schule
        createParams.unshift({
            id: event.organisationId,
            name: `${event.kennung} (${event.name || 'Unbenannte Schule'})`,
            type: 'School',
            parentId: this.ROOT_OEFFENTLICH,
        });

        const createError: Option<DomainError> = await this.itslearningGroupRepo.createOrUpdateGroups(createParams);

        if (createError) {
            return this.logger.error(
                `Could not create Schule (ID ${event.organisationId}) and its Klassen in itsLearning: ${createError.message}`,
            );
        }

        this.logger.info(`Schule with ID ${event.organisationId} and its ${klassen.length} Klassen were created.`);
    }
}
