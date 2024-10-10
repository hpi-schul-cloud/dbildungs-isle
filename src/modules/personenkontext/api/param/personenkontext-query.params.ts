import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PagedQueryParams } from '../../../../shared/paging/paged.query.params.js';
import {
    Personenstatus,
    PersonenstatusTypName,
    SichtfreigabeType,
    SichtfreigabeTypName,
} from '../../domain/personenkontext.enums.js';
import { AutoMap } from '@automapper/classes';

export class PersonenkontextQueryParams extends PagedQueryParams {
    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly personId?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly referrer?: string;

    @AutoMap()
    @IsOptional()
    @IsEnum(Personenstatus)
    @ApiProperty({
        required: false,
        nullable: true,
        enum: Personenstatus,
        enumName: PersonenstatusTypName,
    })
    public readonly personenstatus?: Personenstatus;

    @AutoMap()
    @IsOptional()
    @IsEnum(SichtfreigabeType)
    @ApiProperty({
        enum: SichtfreigabeType,
        enumName: SichtfreigabeTypName,
        default: SichtfreigabeType.NEIN,
        required: false,
        nullable: true,
    })
    public readonly sichtfreigabe: SichtfreigabeType = SichtfreigabeType.NEIN;
}
