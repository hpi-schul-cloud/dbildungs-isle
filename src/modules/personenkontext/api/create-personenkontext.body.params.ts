import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
    Jahrgangsstufe,
    JahrgangsstufeTypName,
    Personenstatus,
    PersonenstatusTypName,
    Rolle,
    RolleTypName,
} from '../domain/personenkontext.enums.js';

export class CreatePersonenkontextBodyParams {
    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly referrer?: string;

    @AutoMap()
    @IsEnum(Rolle)
    @ApiProperty({ enum: Rolle, enumName: RolleTypName, required: true })
    public readonly rolle!: Rolle;

    @AutoMap()
    @IsEnum(Personenstatus)
    @IsOptional()
    @ApiProperty({ enum: Personenstatus, enumName: PersonenstatusTypName, required: false })
    public readonly personenstatus?: Personenstatus;

    @AutoMap()
    @IsEnum(Jahrgangsstufe)
    @IsOptional()
    @ApiProperty({ enum: Jahrgangsstufe, enumName: JahrgangsstufeTypName, required: false })
    public readonly jahrgangsstufe?: Jahrgangsstufe;
}
