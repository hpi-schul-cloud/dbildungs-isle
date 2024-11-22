import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mutex } from 'async-mutex';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ItsLearningConfig, ServerConfig } from '../../../shared/config/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
    PersonenkontextUpdatedPersonData,
} from '../../../shared/events/personenkontext-updated.event.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { ServiceProviderSystem } from '../../service-provider/domain/service-provider.enum.js';
import { PersonResponse } from '../actions/read-person.action.js';
import { ItslearningMembershipRepo } from '../repo/itslearning-membership.repo.js';
import { ItslearningPersonRepo } from '../repo/itslearning-person.repo.js';
import { determineHighestRollenart, rollenartToIMSESInstitutionRole } from '../repo/role-utils.js';
import { IMSESInstitutionRoleType } from '../types/role.enum.js';

@Injectable()
export class ItsLearningPersonsEventHandler {
    // Mutex to run updates
    private readonly personUpdateMutex: Mutex = new Mutex();

    public ENABLED: boolean;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly itslearningPersonRepo: ItslearningPersonRepo,
        private readonly itslearningMembershipRepo: ItslearningMembershipRepo,
        configService: ConfigService<ServerConfig>,
    ) {
        const itsLearningConfig: ItsLearningConfig = configService.getOrThrow<ItsLearningConfig>('ITSLEARNING');

        this.ENABLED = itsLearningConfig.ENABLED === 'true';
    }

    @EventHandler(PersonRenamedEvent)
    public async personRenamedEventHandler(event: PersonRenamedEvent): Promise<void> {
        await this.personUpdateMutex.runExclusive(async () => {
            this.logger.info(`Received PersonRenamedEvent, ${event.personId}`);

            if (!this.ENABLED) {
                return this.logger.info('Not enabled, ignoring event.');
            }

            if (!event.referrer) {
                return this.logger.error(`Person with ID ${event.personId} has no username!`);
            }

            const readPersonResult: Option<PersonResponse> = await this.itslearningPersonRepo.readPerson(
                event.personId,
            );

            if (!readPersonResult) {
                return this.logger.info(`Person with ID ${event.personId} is not in itslearning, ignoring.`);
            }

            const updatePersonError: Option<DomainError> = await this.itslearningPersonRepo.createOrUpdatePerson({
                id: event.personId,
                firstName: event.vorname,
                lastName: event.familienname,
                username: event.referrer,
                institutionRoleType: readPersonResult.institutionRole,
            });

            if (updatePersonError) {
                return this.logger.error(`Person with ID ${event.personId} could not be updated in itsLearning!`);
            }

            this.logger.info(`Person with ID ${event.personId} updated in itsLearning!`);
        });
    }

    @EventHandler(OxUserChangedEvent)
    public async oxUserChangedEventHandler(event: OxUserChangedEvent): Promise<void> {
        if (!this.ENABLED) {
            return this.logger.info('Not enabled, ignoring email update.');
        }

        await this.personUpdateMutex.runExclusive(async () => {
            this.logger.info(`Received OxUserChangedEvent, ${event.personId}`);

            const updateError: Option<DomainError> = await this.itslearningPersonRepo.updateEmail(
                event.personId,
                event.primaryEmail,
            );

            if (updateError) {
                this.logger.error(`Could not update E-Mail for person with ID ${event.personId}!`);
            } else {
                this.logger.info(`Updated E-Mail for person with ID ${event.personId}!`);
            }
        });
    }

    @EventHandler(PersonenkontextUpdatedEvent)
    public async updatePersonenkontexteEventHandler(event: PersonenkontextUpdatedEvent): Promise<void> {
        await this.personUpdateMutex.runExclusive(async () => {
            this.logger.info(`Received PersonenkontextUpdatedEvent, ${event.person.id}`);

            if (!this.ENABLED) {
                return this.logger.info('Not enabled, ignoring event.');
            }

            // Find all removed or current kontexte that have itslearning
            const [currentKontexte]: [PersonenkontextUpdatedData[]] = this.filterRelevantKontexte(
                event.currentKontexte,
            );

            if (currentKontexte.length > 0) {
                // Person should have itslearning, create/update them as necessary
                await this.updatePerson(event.person, currentKontexte);

                // Synchronize memberships
                await this.updateMemberships(event.person.id, currentKontexte);
            } else {
                // Delete person
                await this.deletePerson(event.person.id);
            }
        });
    }

    public async updateMemberships(personId: PersonID, currentKontexte: PersonenkontextUpdatedData[]): Promise<void> {
        const setMembershipsResult: Result<unknown, DomainError> = await this.itslearningMembershipRepo.setMemberships(
            personId,
            currentKontexte.map((pk: PersonenkontextUpdatedData) => ({ organisationId: pk.orgaId, role: pk.rolle })),
        );

        if (!setMembershipsResult.ok) {
            this.logger.error(
                `Could not set ${currentKontexte.length} memberships for person ${personId}`,
                setMembershipsResult.error,
            );
        } else {
            this.logger.info(`Set ${currentKontexte.length} memberships for person ${personId}`);
        }
    }

    /**
     * Updates the person based on the current personenkontexte
     */
    public async updatePerson(
        person: PersonenkontextUpdatedPersonData,
        currentPersonenkontexte: PersonenkontextUpdatedData[],
    ): Promise<void> {
        if (!person.referrer) {
            return this.logger.error(`Person with ID ${person.id} has no username!`);
        }

        const targetRole: IMSESInstitutionRoleType = rollenartToIMSESInstitutionRole(
            determineHighestRollenart(currentPersonenkontexte.map((pk: PersonenkontextUpdatedData) => pk.rolle)),
        );

        const createError: Option<DomainError> = await this.itslearningPersonRepo.createOrUpdatePerson({
            id: person.id,
            firstName: person.vorname,
            lastName: person.familienname,
            username: person.referrer,
            institutionRoleType: targetRole,
            email: person.email,
        });

        if (createError) {
            return this.logger.error(
                `Person with ID ${person.id} could not be sent to itsLearning! Error: ${createError.message}`,
            );
        }

        return this.logger.info(`Person with ID ${person.id} created in itsLearning!`);
    }

    /**
     * Delete this person in itslearning
     */
    public async deletePerson(personID: PersonID): Promise<void> {
        const deleteError: Option<DomainError> = await this.itslearningPersonRepo.deletePerson(personID);

        if (!deleteError) {
            this.logger.info(`Person with ID ${personID} deleted.`);
        } else {
            this.logger.error(`Could not delete person with ID ${personID} from itsLearning.`);
        }
    }

    private filterRelevantKontexte<T extends [...PersonenkontextUpdatedData[][]]>(...kontexte: T): [...T] {
        // Only keep personenkontexte, that are at itslearning organisations and have a serviceprovider with itslearning-system
        const filteredKontexte: [...T] = kontexte.map((pks: PersonenkontextUpdatedData[]) =>
            pks.filter(
                (pk: PersonenkontextUpdatedData) =>
                    pk.isItslearningOrga &&
                    pk.serviceProviderExternalSystems.includes(ServiceProviderSystem.ITSLEARNING),
            ),
        ) as [...T];

        return filteredKontexte;
    }
}
