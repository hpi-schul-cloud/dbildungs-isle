import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PagedQueryParams } from '../../../shared/paging/index.js';
import { SichtfreigabeType } from '../../personenkontext/domain/personenkontext.enums.js';

export class PersonenQueryParams extends PagedQueryParams {
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
    @IsString()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly familienname?: string;

    @AutoMap()
    @IsOptional()
    @IsString()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly vorname?: string;

    @AutoMap(() => String)
    @IsOptional()
    @IsEnum(SichtfreigabeType)
    @ApiProperty({
        enum: SichtfreigabeType,
        default: SichtfreigabeType.NEIN,
        required: false,
        nullable: true,
    })
    public readonly sichtfreigabe: SichtfreigabeType = SichtfreigabeType.NEIN;

    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({
        description:
            'Search filter used to filter for Persons. It could be the vorname, familienname, referrer or the personalnummer.',
        required: false,
        nullable: true,
    })
    public readonly suchFilter?: string;
}
