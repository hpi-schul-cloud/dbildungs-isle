import { Injectable } from '@nestjs/common';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { EventHandler } from '../../eventbus/decorators/event-handler.decorator.js';
import { LdapClientService, PersonData } from './ldap-client.service.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { OrganisationsTyp } from '../../../modules/organisation/domain/organisation.enums.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { SchuleDeletedEvent } from '../../../shared/events/schule-deleted.event.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
} from '../../../shared/events/personenkontext-updated.event.js';

@Injectable()
export class LdapEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly ldapClientService: LdapClientService,
        private readonly organisationRepository: OrganisationRepository,
    ) {}

    @EventHandler(SchuleCreatedEvent)
    public async handleSchuleCreatedEvent(event: SchuleCreatedEvent): Promise<void> {
        this.logger.info(`Received SchuleCreatedEvent, organisationId:${event.organisationId}`);

        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(
            event.organisationId,
        );
        if (!organisation) {
            this.logger.error(`Organisation with id ${event.organisationId} could not be found!`);
            return;
        }
        this.logger.info(`Kennung of organisation is:${organisation.kennung}`);

        if (organisation.typ == OrganisationsTyp.SCHULE) {
            this.logger.info(`Call LdapClientService because ${organisation.name} type is SCHULE`);
            const creationResult: Result<Organisation<true>> =
                await this.ldapClientService.createOrganisation(organisation);
            if (!creationResult.ok) {
                this.logger.error(creationResult.error.message);
            }
        }
    }

    @EventHandler(SchuleDeletedEvent)
    public async handleSchuleDeletedEvent(event: SchuleDeletedEvent): Promise<void> {
        this.logger.info(`Received SchuleDeletedEvent, organisationId:${event.organisationId}`);
        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(
            event.organisationId,
        );
        if (!organisation) {
            this.logger.error(`Organisation with id ${event.organisationId} could not be found!`);
            return;
        }
        this.logger.info(`Kennung of organisation is:${organisation.kennung}`);

        if (organisation.typ == OrganisationsTyp.SCHULE) {
            this.logger.info(`Call LdapClientService because ${organisation.name} type is SCHULE`);
            const creationResult: Result<Organisation<true>> =
                await this.ldapClientService.deleteOrganisation(organisation);
            if (!creationResult.ok) {
                this.logger.error(creationResult.error.message);
            }
        }
    }

    @EventHandler(PersonenkontextUpdatedEvent)
    public async handlePersonenkontextUpdatedEvent(event: PersonenkontextUpdatedEvent): Promise<void> {
        this.logger.info(
            `Received PersonenkontextCreatedEvent, personId:${event.person.id}, new personenkontexte: ${event.newKontexte.length}, deleted personenkontexte: ${event.removedKontexte.length}`,
        );

        // Delete all removed personenkontexte if rollenart === LEHR
        await Promise.allSettled(
            event.removedKontexte
                .filter((pk: PersonenkontextUpdatedData) => pk.rolle === RollenArt.LEHR)
                .map(async (pk: PersonenkontextUpdatedData) => {
                    this.logger.info(`Call LdapClientService because rollenArt is LEHR`);
                    const deletionResult: Result<PersonData> = await this.ldapClientService.deleteLehrer(event.person, {
                        kennung: pk.orgaKennung,
                    });
                    if (!deletionResult.ok) {
                        this.logger.error(deletionResult.error.message);
                    }
                }),
        );

        // Create personenkontexte if rollenart === LEHR
        await Promise.allSettled(
            event.newKontexte
                .filter((pk: PersonenkontextUpdatedData) => pk.rolle === RollenArt.LEHR)
                .map(async (pk: PersonenkontextUpdatedData) => {
                    this.logger.info(`Call LdapClientService because rollenArt is LEHR`);
                    const creationResult: Result<PersonData> = await this.ldapClientService.createLehrer(event.person, {
                        kennung: pk.orgaKennung,
                    });
                    if (!creationResult.ok) {
                        this.logger.error(creationResult.error.message);
                    }
                }),
        );
    }
}
