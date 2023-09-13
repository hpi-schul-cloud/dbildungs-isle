import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class PersonBirthParams {
    @AutoMap()
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    @ApiProperty({ name: 'datum', required: false })
    public readonly datum?: Date;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({ name: 'geburtsort', required: false })
    public readonly geburtsort?: string;
}
