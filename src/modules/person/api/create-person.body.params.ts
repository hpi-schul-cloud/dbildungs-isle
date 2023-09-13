import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { PersonBirthParams } from './person-birth.params.js';
import { PersonNameParams } from './person-name.params.js';
import { PersonGender, PersonTrustLevel } from './person.enums.js';

export class CreatePersonBodyParams {
    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly referrer?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @IsUUID()
    @ApiProperty({ name: 'mandant', required: true })
    public readonly mandant!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'stammorganisation', required: false })
    public readonly stammorganisation?: string;

    @AutoMap(() => PersonNameParams)
    @ValidateNested()
    @Type(() => PersonNameParams)
    @ApiProperty({ type: PersonNameParams, required: true })
    public readonly name!: PersonNameParams;

    @AutoMap(() => PersonBirthParams)
    @ValidateNested()
    @Type(() => PersonBirthParams)
    @ApiProperty({ name: 'geburt', required: true })
    public readonly geburt!: PersonBirthParams;

    @AutoMap()
    @IsOptional()
    @IsString()
    @IsEnum(PersonGender)
    @ApiProperty({ name: 'geschlecht', enum: PersonGender, required: false })
    public readonly geschlecht?: PersonGender;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'lokalisierung', default: 'de-DE', required: false })
    public readonly lokalisierung?: string = 'de-DE';

    @AutoMap()
    @IsOptional()
    @IsString()
    @IsEnum(PersonTrustLevel)
    @ApiProperty({ name: 'vertrauensstufe', enum: PersonTrustLevel, required: false })
    public readonly vertrauensstufe?: PersonTrustLevel;

    @AutoMap()
    @IsOptional()
    @IsBoolean()
    @ApiProperty({ name: 'auskunftssperre', required: false })
    public readonly auskunftssperre?: boolean;
}
