import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';

export class HatSystemrechtQueryParams {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ enum: RollenSystemRecht, required: true })
    public readonly systemRecht!: string;
}
