import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsArray, ArrayNotEmpty } from 'class-validator';

export class RolleServiceProviderBodyParams {
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

    @IsNumber()
    @ApiProperty({ description: 'The version for the rolle.', required: true })
    public readonly version!: number;
}
