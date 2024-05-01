import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { RollenSystemRecht, RollenSystemRechtTypName } from '../../rolle/domain/rolle.enums.js';

export class HatSystemrechtQueryParams {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ enum: RollenSystemRecht, enumName: RollenSystemRechtTypName, required: true })
    public readonly systemRecht!: string;
}
