import { ApiProperty } from '@nestjs/swagger';
import { Rolle } from '../../../rolle/domain/rolle.js';
import { RolleResponse } from '../../../rolle/api/rolle.response.js';

export class FindRollenResponse {
    public constructor(moeglicheRollen: Rolle<true>[], total: number) {
        this.moeglicheRollen = moeglicheRollen.map((rolle: Rolle<true>) => this.createRolleResponse(rolle));
        this.total = total;
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

    @ApiProperty({ type: [RolleResponse] })
    public readonly moeglicheRollen: RolleResponse[];

    @ApiProperty({ type: Number })
    public readonly total: number;
}
