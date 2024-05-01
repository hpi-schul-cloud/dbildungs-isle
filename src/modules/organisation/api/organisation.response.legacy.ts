import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { OrganisationsTyp, Traegerschaft } from '../domain/organisation.enums.js';

export class OrganisationResponseLegacy {
    //Legacy Response With Automapper used for Non DDD Architecture
    @AutoMap()
    @ApiProperty()
    public readonly id!: string;

    @AutoMap()
    @ApiProperty({ nullable: true })
    public readonly kennung?: string;

    @AutoMap()
    @ApiProperty()
    public readonly name!: string;

    @AutoMap()
    @ApiProperty({ nullable: true })
    public readonly namensergaenzung?: string;

    @AutoMap()
    @ApiProperty()
    public readonly kuerzel?: string;

    @AutoMap(() => String)
    @ApiProperty({ enum: OrganisationsTyp })
    public readonly typ!: OrganisationsTyp;

    @AutoMap(() => String)
    public traegerschaft?: Traegerschaft;
}
