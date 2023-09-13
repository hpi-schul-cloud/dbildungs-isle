import { AutoMap } from '@automapper/classes';
import { PersonNameParams } from './person-name.params.js';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PersonBirthParams } from './person-birth.params.js';
import { TrustLevel } from '../domain/person.enums.js';

export class PersonResponse {
    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty()
    public id!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public referrer?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @IsUUID()
    @ApiProperty({ name: 'mandant', required: true })
    public mandant: string = '';

    @AutoMap(() => PersonNameParams)
    @ValidateNested()
    @Type(() => PersonNameParams)
    @ApiProperty({ name: 'name', type: PersonNameParams, required: true })
    public name!: PersonNameParams;

    @AutoMap()
    @ValidateNested()
    @Type(() => PersonBirthParams)
    @ApiProperty({ name: 'geburt', type: PersonBirthParams, required: true })
    public geburt!: PersonBirthParams;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'stammorganisation', required: false })
    public readonly stammorganisation?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'geschlecht', required: true })
    public geschlecht!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'lokalisierung', required: true })
    public lokalisierung!: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'vertrauensstufe', required: true })
    public vertrauensstufe!: TrustLevel;
}
