import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import { OrganisationID, PersonID, RolleID } from '../../../../shared/types/index.js';

export class DbiamPersonenkontextMigrationBodyParams {
    @IsString()
    @IsUUID()
    @IsOptional()
    @ApiProperty({ type: String })
    public readonly personId?: PersonID;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly username?: string;

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    @ApiProperty({ type: String })
    public readonly organisationId!: OrganisationID;

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    @ApiProperty({ type: String })
    public readonly rolleId!: RolleID;

    @IsDate()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly befristung?: Date;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly email?: string;
}
