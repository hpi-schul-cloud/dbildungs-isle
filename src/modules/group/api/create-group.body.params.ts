import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
    Bildungsziele,
    Faecherkanon,
    Gruppenbereich,
    GruppenTyp,
    Gruppendifferenzierung,
    Gruppenoption,
} from '../domain/gruppe.enums.js';
import { Jahrgangsstufe } from '../../personenkontext/domain/personenkontext.enums.js';
import { Type } from 'class-transformer';
import { Referenzgruppen } from '../domain/referenzgruppen.js';
import { Laufzeit } from '../persistence/laufzeit.js';
export class CreateGroupBodyParams {
    @IsString()
    @ApiProperty({ required: false })
    public readonly referrer?: string;

    @IsString()
    @ApiProperty({ required: true })
    public readonly bezeichnung!: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly thema?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly beschreibung?: string;

    @IsEnum(GruppenTyp)
    @ApiProperty({ enum: GruppenTyp, required: true })
    public readonly typ!: GruppenTyp;

    @IsEnum(Gruppenbereich)
    @ApiProperty({ enum: Gruppenbereich, required: false })
    public readonly bereich?: Gruppenbereich;

    @IsArray()
    @IsEnum(Gruppenoption, { each: true })
    @ApiProperty({ enum: Gruppenoption, required: false, isArray: true })
    public readonly optionen?: Gruppenoption[];

    @IsEnum(Gruppendifferenzierung)
    @ApiProperty({ enum: Gruppendifferenzierung, required: false })
    public readonly differenzierung?: Gruppendifferenzierung;

    @IsArray()
    @IsEnum(Bildungsziele, { each: true })
    @ApiProperty({ enum: Bildungsziele, required: false, isArray: true })
    public readonly bildungsziele?: Bildungsziele[];

    @IsArray()
    @IsEnum(Jahrgangsstufe, { each: true })
    @ApiProperty({ enum: Jahrgangsstufe, required: false, isArray: true })
    public readonly jahrgangsstufen?: Jahrgangsstufe[];

    @IsArray()
    @IsEnum(Faecherkanon, { each: true })
    @ApiProperty({ enum: Faecherkanon, required: false, isArray: true })
    public readonly faecher?: Faecherkanon[];

    @IsArray()
    @ValidateNested()
    @Type(() => Referenzgruppen)
    @ApiProperty({ type: Referenzgruppen, required: false, isArray: true })
    public readonly referenzgruppen?: Referenzgruppen[];

    @ValidateNested()
    @Type(() => Laufzeit)
    @ApiProperty({ type: Laufzeit, required: false })
    public readonly laufzeit!: Laufzeit;
}
