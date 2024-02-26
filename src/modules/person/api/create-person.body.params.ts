import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PersonBirthParams } from './person-birth.params.js';
import { PersonNameParams } from './person-name.params.js';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';
import { AutoMap } from '@automapper/classes';

export class CreatePersonBodyParams {
    @AutoMap()
    @IsOptional()
    @IsEmail()
    @ApiProperty({ required: false })
    public readonly email?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly referrer?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly stammorganisation?: string;

    @AutoMap(() => PersonNameParams)
    @ValidateNested()
    @Type(() => PersonNameParams)
    @ApiProperty({ type: PersonNameParams, required: true })
    public readonly name!: PersonNameParams;

    @AutoMap(() => PersonBirthParams)
    @IsOptional()
    @ValidateNested()
    @Type(() => PersonBirthParams)
    @ApiProperty({ type: PersonBirthParams, required: false })
    public readonly geburt?: PersonBirthParams;

    @AutoMap(() => String)
    @IsOptional()
    @IsString()
    @IsEnum(Geschlecht)
    @ApiProperty({ enum: Geschlecht, required: false })
    public readonly geschlecht?: Geschlecht;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly lokalisierung?: string;

    @AutoMap(() => String)
    @IsOptional()
    @IsString()
    @IsEnum(Vertrauensstufe)
    @ApiProperty({ enum: Vertrauensstufe, required: false })
    public readonly vertrauensstufe?: Vertrauensstufe;

    @AutoMap()
    @IsOptional()
    @IsBoolean()
    @ApiProperty({ required: false })
    public readonly auskunftssperre?: boolean;
}
