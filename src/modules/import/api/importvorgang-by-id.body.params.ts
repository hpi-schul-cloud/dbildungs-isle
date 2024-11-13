import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { OrganisationID, RolleID } from '../../../shared/types/aggregate-ids.types.js';

export class ImportvorgangByIdBodyParams {
    @IsUUID()
    @ApiProperty({
        description: 'The id of an import transaction',
        required: true,
        nullable: false,
    })
    public importvorgangId!: string;

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
}
