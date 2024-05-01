import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsEnum, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../domain/rolle.enums.js';
import { IsDIN91379AEXT } from '../../../shared/util/din-91379-validation.js';

export class CreateRolleBodyParams {
    @ApiProperty()
    @IsDIN91379AEXT()
    @IsNotEmpty()
    @MaxLength(200)
    public name!: string;

    @IsUUID()
    @ApiProperty()
    public administeredBySchulstrukturknoten!: string;

    @IsEnum(RollenArt)
    @ApiProperty({ enum: RollenArt })
    public rollenart!: RollenArt;

    @IsEnum(RollenMerkmal, { each: true })
    @ArrayUnique()
    @ApiProperty({ enum: RollenMerkmal, isArray: true, uniqueItems: true })
    public merkmale!: RollenMerkmal[];

    @IsEnum(RollenSystemRecht, { each: true })
    @ArrayUnique()
    @ApiProperty({ enum: RollenSystemRecht, isArray: true, uniqueItems: true })
    public systemrechte!: RollenSystemRecht[];
}
