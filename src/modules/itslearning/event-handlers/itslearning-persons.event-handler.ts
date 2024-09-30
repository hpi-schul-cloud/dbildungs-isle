import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mutex } from 'async-mutex';
import { uniq } from 'lodash-es';

import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ItsLearningConfig, ServerConfig } from '../../../shared/config/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
    PersonenkontextUpdatedPersonData,
} from '../../../shared/events/personenkontext-updated.event.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { ServiceProviderSystem } from '../../service-provider/domain/service-provider.enum.js';
import { CreateMembershipParams, CreateMembershipsAction } from '../actions/create-memberships.action.js';
import { CreatePersonAction } from '../actions/create-person.action.js';
import { DeleteMembershipsAction } from '../actions/delete-memberships.action.js';
import { DeletePersonAction } from '../actions/delete-person.action.js';
import { MembershipResponse, ReadMembershipsForPersonAction } from '../actions/read-memberships-for-person.action.js';
import { PersonResponse, ReadPersonAction } from '../actions/read-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { IMSESInstitutionRoleType, IMSESRoleType } from '../types/role.enum.js';

// Maps our roles to itsLearning roles
const ROLLENART_TO_ITSLEARNING_ROLE: Record<RollenArt, IMSESInstitutionRoleType> = {
    [RollenArt.EXTERN]: IMSESInstitutionRoleType.GUEST,
    [RollenArt.LERN]: IMSESInstitutionRoleType.STUDENT,
    [RollenArt.LEHR]: IMSESInstitutionRoleType.STAFF,
    [RollenArt.LEIT]: IMSESInstitutionRoleType.ADMINISTRATOR,
    [RollenArt.ORGADMIN]: IMSESInstitutionRoleType.ADMINISTRATOR,
    [RollenArt.SYSADMIN]: IMSESInstitutionRoleType.SYSTEM_ADMINISTRATOR,
};

// Maps our roles to IMS ES roles (Different from InstitutionRoleType)
const ROLLENART_TO_IMSES_ROLE: Record<RollenArt, IMSESRoleType> = {
    [RollenArt.EXTERN]: IMSESRoleType.MEMBER,
    [RollenArt.LERN]: IMSESRoleType.LEARNER,
    [RollenArt.LEHR]: IMSESRoleType.INSTRUCTOR,
    [RollenArt.LEIT]: IMSESRoleType.ADMINISTRATOR,
    [RollenArt.ORGADMIN]: IMSESRoleType.ADMINISTRATOR,
    [RollenArt.SYSADMIN]: IMSESRoleType.ADMINISTRATOR,
};

// Determines order of roles.
// example: If person has both a EXTERN and a LEHR role, the LEHR role has priority
const ROLLENART_ORDER: RollenArt[] = [
    RollenArt.EXTERN,
    RollenArt.LERN,
    RollenArt.LEHR,
    RollenArt.LEIT,
    RollenArt.ORGADMIN,
    RollenArt.SYSADMIN,
];

@Injectable()
export class ItsLearningPersonsEventHandler {
    public ENABLED: boolean;

    private readonly mutex: Mutex = new Mutex();

    public constructor(
        private readonly logger: ClassLogger,
        private readonly itsLearningService: ItsLearningIMSESService,
        configService: ConfigService<ServerConfig>,
    ) {
        const itsLearningConfig: ItsLearningConfig = configService.getOrThrow<ItsLearningConfig>('ITSLEARNING');

        this.ENABLED = itsLearningConfig.ENABLED === 'true';
    }

    @EventHandler(PersonenkontextUpdatedEvent)
    public async updatePersonenkontexteEventHandler(event: PersonenkontextUpdatedEvent): Promise<void> {
        this.logger.info(`Received PersonenkontextUpdatedEvent, ${event.person.id}`);

        if (!this.ENABLED) {
            return this.logger.info('Not enabled, ignoring event.');
        }

        // Find all removed or current kontexte that have itslearning
        const [removedKontexte, currentKontexte]: [PersonenkontextUpdatedData[], PersonenkontextUpdatedData[]] =
            this.filterRelevantKontexte(event.removedKontexte, event.currentKontexte);

        // Person should have itslearning, create/update them as necessary
        if (currentKontexte.length > 0) {
            await this.updatePerson(event.person, currentKontexte);
        }

        // Synchronize memberships
        await this.updateMemberships(event.person.id, currentKontexte, removedKontexte);

        // Delete person (After updating memberships, to make sure they are removed in case the person is restored)
        if (currentKontexte.length === 0) {
            await this.deletePerson(event.person.id);
        }
    }

    public async updateMemberships(
        personId: PersonID,
        currentKontexte: PersonenkontextUpdatedData[],
        removedKontexte: PersonenkontextUpdatedData[],
    ): Promise<void> {
        // Retrieve memberships
        const membershipResult: Result<MembershipResponse[], DomainError> = await this.itsLearningService.send(
            new ReadMembershipsForPersonAction(personId),
        );
        if (!membershipResult.ok) {
            return this.logger.error(
                `Could not retrieve memberships for ${personId}, the user might not exist.`,
                membershipResult.error,
            );
        }

        // Determine all organisations and roles the user SHOULD have
        const organisations: OrganisationID[] = uniq(
            currentKontexte.map((pk: PersonenkontextUpdatedData) => pk.orgaId),
        );
        const orgaRoleMap: Map<OrganisationID, IMSESRoleType> = new Map(
            organisations.map(
                (orgaId: OrganisationID) =>
                    [orgaId, ROLLENART_TO_IMSES_ROLE[this.determineHighestRoleType(currentKontexte, orgaId)]] as const,
            ),
        );

        // Determine all memberships that need to be removed and send DeleteMembershipsAction
        const removedOrgaIDs: Set<OrganisationID> = new Set(
            removedKontexte
                .map((pk: PersonenkontextUpdatedData) => pk.orgaId)
                .filter((orgaId: OrganisationID) => !orgaRoleMap.has(orgaId)),
        );
        const membershipsToBeRemoved: MembershipResponse[] = membershipResult.value.filter((mr: MembershipResponse) =>
            removedOrgaIDs.has(mr.groupId),
        );

        if (membershipsToBeRemoved.length > 0) {
            const deleteResult: Result<void, DomainError> = await this.itsLearningService.send(
                new DeleteMembershipsAction(membershipsToBeRemoved.map((mr: MembershipResponse) => mr.id)),
            );

            if (!deleteResult.ok) {
                this.logger.error(
                    `Could not delete ${membershipsToBeRemoved.length} memberships for person ${personId}`,
                    deleteResult.error,
                );
            } else {
                this.logger.info(`Deleted ${membershipsToBeRemoved.length} memberships for person ${personId}`);
            }
        }

        // Add and Update memberships with correct roles
        const memberships: CreateMembershipParams[] = Array.from(orgaRoleMap.entries()).map(
            ([orga, rolle]: [OrganisationID, IMSESRoleType]) => ({
                id: `membership-${orga}`,
                groupId: orga,
                personId: personId,
                roleType: rolle,
            }),
        );

        if (memberships.length > 0) {
            const createMembershipsAction: CreateMembershipsAction = new CreateMembershipsAction(memberships);
            const createResult: Result<void, DomainError> = await this.itsLearningService.send(createMembershipsAction);

            if (!createResult.ok) {
                this.logger.error(
                    `Could not create/update ${memberships.length} memberships for person ${personId}`,
                    createResult.error,
                );
            } else {
                this.logger.info(`Created/Updated ${memberships.length} memberships for person ${personId}`);
            }
        }
    }

    /**
     * Updates the person based on the current personenkontexte
     */
    public async updatePerson(
        person: PersonenkontextUpdatedPersonData,
        currentPersonenkontexte: PersonenkontextUpdatedData[],
    ): Promise<void> {
        // Use mutex because multiple personenkontexte can be created at once
        return this.mutex.runExclusive(async () => {
            const targetRole: IMSESInstitutionRoleType =
                ROLLENART_TO_ITSLEARNING_ROLE[this.determineHighestRoleType(currentPersonenkontexte)];

            const personResult: Result<PersonResponse, DomainError> = await this.itsLearningService.send(
                new ReadPersonAction(person.id),
            );

            // If user already exists in itsLearning and has the correct role, don't send update
            if (personResult.ok && personResult.value.institutionRole === targetRole) {
                return this.logger.info('Person already exists with correct role');
            }

            if (!person.referrer) {
                return this.logger.error(`Person with ID ${person.id} has no username!`);
            }

            const createAction: CreatePersonAction = new CreatePersonAction({
                id: person.id,
                firstName: person.vorname,
                lastName: person.familienname,
                username: person.referrer,
                institutionRoleType: targetRole,
            });

            const createResult: Result<void, DomainError> = await this.itsLearningService.send(createAction);

            if (!createResult.ok) {
                return this.logger.error(`Person with ID ${person.id} could not be sent to itsLearning!`);
            }

            return this.logger.info(`Person with ID ${person.id} created in itsLearning!`);
        });
    }

    /**
     * Delete this person in itslearning
     */
    public async deletePerson(personID: PersonID): Promise<void> {
        return this.mutex.runExclusive(async () => {
            const deleteResult: Result<void, DomainError> = await this.itsLearningService.send(
                new DeletePersonAction(personID),
            );

            if (deleteResult.ok) {
                this.logger.info(`Person with ID ${personID} deleted.`);
            } else {
                this.logger.error(`Could not delete person with ID ${personID} from itsLearning.`);
            }
        });
    }

    private determineHighestRoleType(
        personenkontexte: PersonenkontextUpdatedData[],
        organisation?: OrganisationID,
    ): RollenArt {
        let highestRole: number = 0;

        for (const { rolle, orgaId } of personenkontexte) {
            if (!organisation || organisation === orgaId) {
                highestRole = Math.max(highestRole, ROLLENART_ORDER.indexOf(rolle));
            }
        }

        // Null assertion is valid here, highestRole can never be OOB
        return ROLLENART_ORDER[highestRole]!;
    }

    private filterRelevantKontexte<T extends [...PersonenkontextUpdatedData[][]]>(...kontexte: T): [...T] {
        // Only keep personenkontexte, have a serviceprovider with itslearning-system
        const filteredKontexte: [...T] = kontexte.map((pks: PersonenkontextUpdatedData[]) =>
            pks.filter((pk: PersonenkontextUpdatedData) =>
                pk.serviceProviderExternalSystems.includes(ServiceProviderSystem.ITSLEARNING),
            ),
        ) as [...T];

        return filteredKontexte;
    }
}
