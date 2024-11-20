import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ItsLearningConfig } from '../../../shared/config/itslearning.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { DomainError } from '../../../shared/error/index.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { CreateMembershipParams, CreateMembershipsAction } from '../actions/create-memberships.action.js';
import { DeleteMembershipsAction } from '../actions/delete-memberships.action.js';
import { MembershipResponse, ReadMembershipsForPersonAction } from '../actions/read-memberships-for-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { determineHighestRollenart, higherRollenart, rollenartToIMSESRole } from './role-utils.js';

export type SetMembershipParams = {
    organisationId: OrganisationID;
    role: RollenArt;
};

export type SetMembershipsResult = {
    deleted: number;
    updated: number;
};

@Injectable()
export class ItslearningMembershipRepo {
    private readonly ROOT_NAMES: string[];

    public constructor(
        private readonly logger: ClassLogger,
        private readonly itslearningService: ItsLearningIMSESService,
        configService: ConfigService<ServerConfig>,
    ) {
        const itslearningConfig: ItsLearningConfig = configService.getOrThrow('ITSLEARNING');

        this.ROOT_NAMES = [itslearningConfig.ROOT, itslearningConfig.ROOT_OEFFENTLICH, itslearningConfig.ROOT_ERSATZ];
    }

    public readMembershipsForPerson(personId: PersonID): Promise<Result<MembershipResponse[], DomainError>> {
        return this.itslearningService.send(new ReadMembershipsForPersonAction(personId));
    }

    public async createMemberships(memberships: CreateMembershipParams[]): Promise<Option<DomainError>> {
        const createMembershipsAction: CreateMembershipsAction = new CreateMembershipsAction(memberships);

        const createResult: Result<void, DomainError> = await this.itslearningService.send(createMembershipsAction);

        if (!createResult.ok) {
            return createResult.error;
        }

        return undefined;
    }

    public async removeMemberships(membershipIDs: string[]): Promise<Option<DomainError>> {
        const deleteResult: Result<void, DomainError> = await this.itslearningService.send(
            new DeleteMembershipsAction(membershipIDs),
        );

        if (!deleteResult.ok) {
            return deleteResult.error;
        }

        return undefined;
    }

    public async setMemberships(
        personId: PersonID,
        memberships: SetMembershipParams[],
    ): Promise<Result<SetMembershipsResult, DomainError>> {
        const returnResult: SetMembershipsResult = {
            updated: 0,
            deleted: 0,
        };

        const currentMemberships: Result<MembershipResponse[], DomainError> =
            await this.readMembershipsForPerson(personId);

        if (!currentMemberships.ok) {
            return {
                ok: false,
                error: currentMemberships.error,
            };
        }

        // Collect memberships into a map
        const membershipsByOrga: Map<OrganisationID, RollenArt> = new Map();
        for (const membership of memberships) {
            const currentRole: RollenArt = membershipsByOrga.get(membership.organisationId) ?? RollenArt.EXTERN;
            membershipsByOrga.set(membership.organisationId, higherRollenart(currentRole, membership.role));
        }

        // Determine highest rollenart and add memberships for the root nodes. Limit the role to "LEHR" (So admins are not admins at root level)
        const highestRollenart: RollenArt = determineHighestRollenart(
            Array.from(membershipsByOrga.values()),
            RollenArt.LEHR,
        );
        for (const m of currentMemberships.value) {
            if (this.ROOT_NAMES.includes(m.groupId)) {
                membershipsByOrga.set(m.groupId, highestRollenart);
            }
        }

        // Find memberships in itslearning that we don't know about
        const membershipsToBeRemoved: MembershipResponse[] = currentMemberships.value.filter(
            (mr: MembershipResponse) => !membershipsByOrga.has(mr.groupId),
        );

        // Remove memberships that are no longer needed
        if (membershipsToBeRemoved.length > 0) {
            const deleteError: Option<DomainError> = await this.removeMemberships(
                membershipsToBeRemoved.map((mr: MembershipResponse) => mr.id),
            );

            if (deleteError) {
                this.logger.error(
                    `Could not delete ${membershipsToBeRemoved.length} memberships for person with ID ${personId}.`,
                    deleteError,
                );
            } else {
                returnResult.deleted = membershipsToBeRemoved.length;
            }
        }

        // Generate memberships to create/update
        const membershipsToCreateOrUpdate: CreateMembershipParams[] = Array.from(membershipsByOrga.entries()).map(
            ([orga, rolle]: [OrganisationID, RollenArt]) => ({
                id: `membership-${personId}-${orga}`,
                groupId: orga,
                personId: personId,
                roleType: rollenartToIMSESRole(rolle),
            }),
        );

        if (membershipsToCreateOrUpdate.length > 0) {
            const createError: Option<DomainError> = await this.createMemberships(membershipsToCreateOrUpdate);

            if (createError) {
                this.logger.error(
                    `Could not create/update ${membershipsToCreateOrUpdate.length} memberships for person with ID ${personId}.`,
                    createError,
                );
            } else {
                returnResult.updated = membershipsToCreateOrUpdate.length;
            }
        }

        return {
            ok: true,
            value: returnResult,
        };
    }
}
