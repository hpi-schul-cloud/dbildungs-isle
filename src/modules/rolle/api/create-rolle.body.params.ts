import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsEnum, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

import {
    RollenArt,
    RollenArtTypName,
    RollenMerkmal,
    RollenMerkmalTypName,
    RollenSystemRecht,
    RollenSystemRechtTypName,
} from '../domain/rolle.enums.js';
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
    @ApiProperty({ enum: RollenArt, enumName: RollenArtTypName })
    public rollenart!: RollenArt;

    @IsEnum(RollenMerkmal, { each: true })
    @ArrayUnique()
    @ApiProperty({ enum: RollenMerkmal, enumName: RollenMerkmalTypName, isArray: true, uniqueItems: true })
    public merkmale!: RollenMerkmal[];

    @IsEnum(RollenSystemRecht, { each: true })
    @ArrayUnique()
    @ApiProperty({ enum: RollenSystemRecht, enumName: RollenSystemRechtTypName, isArray: true, uniqueItems: true })
    public systemrechte!: RollenSystemRecht[];
}
