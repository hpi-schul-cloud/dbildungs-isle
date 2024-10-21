import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { OrganisationID, RolleID } from '../../../shared/types/aggregate-ids.types.js';

export class DbiamPersonenkontextImportBodyParams {
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

    @ApiProperty({ type: String, format: 'binary', required: true })
    public file!: Express.Multer.File;
}
