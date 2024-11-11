import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class OrganisationByNameBodyParams {
    @IsString()
    @ApiProperty({ required: true })
    public readonly name!: string;

    @IsNumber()
    @ApiProperty({ description: 'The version for the organisation.', required: true })
    public readonly version!: number;
}
