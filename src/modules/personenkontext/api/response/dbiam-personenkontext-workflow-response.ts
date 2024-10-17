import { ApiProperty } from '@nestjs/swagger';
import { OrganisationResponseLegacy } from '../../../organisation/api/organisation.response.legacy.js';
import { RolleResponse } from '../../../rolle/api/rolle.response.js';
import { Rolle } from '../../../rolle/domain/rolle.js';

export class PersonenkontextWorkflowResponse {
    @ApiProperty({
        description: 'List of available organisations.',
        type: [OrganisationResponseLegacy],
    })
    public readonly organisations: OrganisationResponseLegacy[];

    @ApiProperty({
        description: 'List of available roles.',
        type: [RolleResponse],
    })
    public readonly rollen: RolleResponse[];

    @ApiProperty({
        description: 'Selected organisation.',
        type: String,
        nullable: true,
    })
    public readonly selectedOrganisation?: string;

    @ApiProperty({
        description: 'Selected rolle.',
        type: String,
        nullable: true,
    })
    public readonly selectedRolle?: string;

    @ApiProperty({
        description: 'Indicates whether the commit action can be performed.',
        type: Boolean,
    })
    public readonly canCommit: boolean;

    public constructor(
        organisations: OrganisationResponseLegacy[],
        rollen: Rolle<true>[],
        canCommit: boolean,
        selectedOrganisation?: string,
        selectedRole?: string,
    ) {
        this.organisations = organisations;
        this.rollen = rollen.map((rolle: Rolle<true>) => this.createRolleResponse(rolle));
        this.selectedOrganisation = selectedOrganisation;
        this.selectedRolle = selectedRole;
        this.canCommit = canCommit;
    }

    private createRolleResponse(rolle: Rolle<true>): RolleResponse {
        return {
            createdAt: rolle.createdAt,
            updatedAt: rolle.updatedAt,
            name: rolle.name,
            id: rolle.id,
            administeredBySchulstrukturknoten: rolle.administeredBySchulstrukturknoten,
            rollenart: rolle.rollenart,
            merkmale: rolle.merkmale,
            systemrechte: rolle.systemrechte,
            version: rolle.version,
        };
    }
}
