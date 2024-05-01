import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Jahrgangsstufe, Personenstatus, Rolle } from '../domain/personenkontext.enums.js';

export class CreatePersonenkontextBodyParams {
    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly referrer?: string;

    @AutoMap()
    @IsEnum(Rolle)
    @ApiProperty({ enum: Rolle, required: true })
    public readonly rolle!: Rolle;

    @AutoMap()
    @IsEnum(Personenstatus)
    @IsOptional()
    @ApiProperty({ enum: Personenstatus, required: false })
    public readonly personenstatus?: Personenstatus;

    @AutoMap()
    @IsEnum(Jahrgangsstufe)
    @IsOptional()
    @ApiProperty({ enum: Jahrgangsstufe, required: false })
    public readonly jahrgangsstufe?: Jahrgangsstufe;
}
