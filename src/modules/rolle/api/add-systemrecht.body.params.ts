import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { RollenSystemRecht, RollenSystemRechtTypName } from '../domain/rolle.enums.js';

export class AddSystemrechtBodyParams {
    @IsEnum(RollenSystemRecht)
    @IsNotEmpty()
    @ApiProperty({ enum: RollenSystemRecht, enumName: RollenSystemRechtTypName, required: true })
    public readonly systemRecht!: RollenSystemRecht;
}
