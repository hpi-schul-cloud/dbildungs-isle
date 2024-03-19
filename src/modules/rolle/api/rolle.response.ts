import { ApiProperty } from '@nestjs/swagger';
import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../domain/rolle.enums.js';
import { Rolle } from '../domain/rolle.js';

export class RolleResponse {
    @ApiProperty()
    public id: string;

    @ApiProperty()
    public createdAt: Date;

    @ApiProperty()
    public updatedAt: Date;

    @ApiProperty()
    public name: string;

    @ApiProperty()
    public administeredBySchulstrukturknoten: string;

    @ApiProperty({ enum: RollenArt })
    public rollenart: RollenArt;

    @ApiProperty({ enum: RollenMerkmal, isArray: true, uniqueItems: true })
    public merkmale: RollenMerkmal[];

    @ApiProperty({ enum: RollenSystemRecht, isArray: true, uniqueItems: true })
    public systemrechte: RollenSystemRecht[];

    public constructor(rolle: Rolle<true>) {
        this.id = rolle.id;
        this.createdAt = rolle.createdAt;
        this.updatedAt = rolle.updatedAt;
        this.name = rolle.name;
        this.administeredBySchulstrukturknoten = rolle.administeredBySchulstrukturknoten;
        this.rollenart = rolle.rollenart;
        this.merkmale = rolle.merkmale;
        this.systemrechte = rolle.systemrechte;
    }
}
