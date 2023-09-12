import { AutoMap } from '@automapper/classes';
import { PersonNameParams } from './person-name.params.js';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

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
    @Expose({ name: 'mandant' })
    @ApiProperty({ name: 'mandant', required: true })
    public client: string = '';

    @AutoMap(() => PersonNameParams)
    @ValidateNested()
    @Type(() => PersonNameParams)
    @ApiProperty({ type: PersonNameParams, required: true })
    public name!: PersonNameParams;
}
