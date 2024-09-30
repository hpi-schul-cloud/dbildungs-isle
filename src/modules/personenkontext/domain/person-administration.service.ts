import { Injectable } from '@nestjs/common';
import { PermittedOrgas, PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationMatchesRollenart } from '../specification/organisation-matches-rollenart.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';

@Injectable()
export class PersonAdministrationService {
    public constructor(
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepository: OrganisationRepository,
    ) {}

    public async findAuthorizedRollen(
        permissions: PersonPermissions,
        rolleName?: string,
        limit?: number,
    ): Promise<Rolle<true>[]> {
        let rollen: Option<Rolle<true>[]>;

        if (rolleName) {
            rollen = await this.rolleRepo.findByName(rolleName, false);
        } else {
            rollen = await this.rolleRepo.find(false);
        }

        if (!rollen) return [];

        const permittedOrgas: PermittedOrgas = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        //Landesadmin can view all roles.
        if (permittedOrgas.all) {
            return limit ? rollen.slice(0, limit) : rollen;
        }

        const allowedRollen: Rolle<true>[] = [];
        const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
        (await this.organisationRepository.findByIds(permittedOrgas.orgaIds)).forEach(function (
            orga: Organisation<true>,
        ) {
            rollen.forEach(function (rolle: Rolle<true>) {
                if (organisationMatchesRollenart.isSatisfiedBy(orga, rolle) && !allowedRollen.includes(rolle)) {
                    allowedRollen.push(rolle);
                }
            });
        });

        return limit ? allowedRollen.slice(0, limit) : allowedRollen;
    }
}
