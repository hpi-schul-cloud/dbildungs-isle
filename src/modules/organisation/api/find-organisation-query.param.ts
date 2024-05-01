import { AutoMap } from '@automapper/classes';
import { PagedQueryParams } from '../../../shared/paging/index.js';
import { ArrayUnique, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganisationsTyp, OrganisationsTypName } from '../domain/organisation.enums.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { TransformToArray } from '../../../shared/util/array-transform.validator.js';

export class FindOrganisationQueryParams extends PagedQueryParams {
    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly kennung?: string;

    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly name?: string;

    @AutoMap()
    @IsString()
    @IsOptional()
    @ApiProperty({
        required: false,
        nullable: true,
    })
    public readonly searchString?: string;

    @AutoMap(() => String)
    @IsEnum(OrganisationsTyp)
    @IsOptional()
    @ApiProperty({
        required: false,
        nullable: true,
        enum: OrganisationsTyp,
        default: OrganisationsTyp.SONSTIGE,
    })
    public readonly typ?: OrganisationsTyp;

    @AutoMap(() => String)
    @IsOptional()
    @TransformToArray()
    @IsEnum(RollenSystemRecht, { each: true })
    @ArrayUnique()
    @ApiProperty({
        required: false,
        nullable: true,
        enum: RollenSystemRecht,
        enumName: 'RollenSystemRecht',
        isArray: true,
    })
    public readonly systemrechte: RollenSystemRecht[] = [];
}
