import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class PersonNameParams {
    @AutoMap()
    @IsString()
    @ApiProperty({ name: 'familienname', required: true })
    public readonly familienname!: string;

    @AutoMap()
    @IsString()
    @ApiProperty({ name: 'vorname', required: true })
    public readonly vorname!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'initialenfamilienname', required: false })
    public readonly initialenfamilienname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'initialenvorname', required: false })
    public readonly initialenvorname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'rufname', required: false })
    public readonly rufname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'titel', required: false })
    public readonly title?: string;

    @AutoMap()
    @IsOptional()
    @IsArray()
    @ApiProperty({ name: 'anrede', required: false })
    public readonly anrede?: string[];

    @AutoMap()
    @IsOptional()
    @IsArray()
    @ApiProperty({ name: 'namenssuffix', required: false })
    public readonly namenssuffix?: string[];

    @AutoMap()
    @IsOptional()
    @IsArray()
    @ApiProperty({ name: 'namenspraefix' })
    public readonly namenspraefix?: string[];

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'sortierindex', required: false })
    public readonly sortierindex?: string;
}
