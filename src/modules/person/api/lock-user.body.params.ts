import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LockUserBodyParams {
    @IsBoolean()
    @ApiProperty({
        required: true,
        nullable: false,
    })
    public readonly lock!: boolean;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        required: true,
        nullable: false,
    })
    public readonly locked_by!: string;

    @IsOptional()
    @IsDate()
    @ApiPropertyOptional({ description: 'Required if Befristung is set' })
    public readonly locked_until?: Date;
}
