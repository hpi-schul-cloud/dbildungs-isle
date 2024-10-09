import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsDIN91379A } from '../../../shared/util/din-91379-validation.js';

export class PersonMetadataBodyParams {
    @IsDIN91379A()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ required: true })
    public readonly familienname!: string;

    @IsDIN91379A()
    @IsNotEmpty()
    @MinLength(2)
    @ApiProperty({ required: true })
    public readonly vorname!: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false })
    public readonly personalnummer?: string;

    @IsDate()
    @ApiProperty({
        required: true,
        description: 'Date of the most recent changed Personalnummer',
    })
    public readonly lastModified!: Date;

    @IsString()
    @ApiProperty({ required: true })
    public readonly revision!: string;
}
