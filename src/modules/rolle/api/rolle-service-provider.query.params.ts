import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ArrayNotEmpty } from 'class-validator';

export class RolleServiceProviderQueryParams {
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('all', { each: true })
    @ApiProperty({
        description: 'An array of ids for the service providers.',
        required: true,
        nullable: false,
        isArray: true,
        type: String,
    })
    public readonly serviceProviderIds!: string[];
}
