import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Jahrgangsstufe, Personenstatus } from '../domain/personenkontext.enums.js';

export class UpdatePersonenkontextBodyParams {
    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: 'The new referrer of the personenkontext.' })
    public readonly referrer?: string;

    @AutoMap(() => String)
    @IsEnum(Personenstatus)
    @IsOptional()
    @ApiProperty({
        enum: Personenstatus,
        required: false,
        description: 'The new personenstatus of the personenkontext.',
    })
    public readonly personenstatus?: Personenstatus;

    @AutoMap(() => String)
    @IsEnum(Jahrgangsstufe)
    @IsOptional()
    @ApiProperty({
        enum: Jahrgangsstufe,
        required: false,
        description: 'The new jahrgangsstufe of the personenkontext.',
    })
    public readonly jahrgangsstufe?: Jahrgangsstufe;

    @AutoMap()
    @IsString()
    @ApiProperty({ required: true, description: 'The revision of the personenkontext.' })
    public readonly revision!: string;
}
