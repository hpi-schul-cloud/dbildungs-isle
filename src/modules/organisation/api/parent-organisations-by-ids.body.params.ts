import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray } from 'class-validator';

export class ParentOrganisationsByIdsBodyParams {
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({
        description: 'The ids of organizations',
        required: true,
        nullable: false,
    })
    public organisationIds!: string[];
}
