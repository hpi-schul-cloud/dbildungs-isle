import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class PersonNameParams {
    @AutoMap()
    @IsString()
    @ApiProperty({ required: true })
    public readonly familienname!: string;

    @AutoMap()
    @IsString()
    @ApiProperty({ required: true })
    public readonly vorname!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly initialenfamilienname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly initialenvorname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly rufname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly titel?: string;

    @AutoMap(() => [String])
    @IsOptional()
    @IsArray()
    @ApiProperty({ type: [String], required: false })
    public readonly anrede?: string[];

    @AutoMap(() => [String])
    @IsOptional()
    @IsArray()
    @ApiProperty({ type: [String], required: false })
    public readonly namenssuffix?: string[];

    @AutoMap(() => [String])
    @IsOptional()
    @IsArray()
    @ApiProperty({ type: [String], required: false })
    public readonly namenspraefix?: string[];

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly sortierindex?: string;
}
