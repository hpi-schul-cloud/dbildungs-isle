import { AutoMap } from '@automapper/classes';
import { PagedQueryParams } from '../../../shared/paging/index.js';
import { ArrayUnique, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganisationsTyp, OrganisationsTypName } from '../domain/organisation.enums.js';
import { RollenSystemRecht, RollenSystemRechtTypName } from '../../rolle/domain/rolle.enums.js';
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
        enumName: OrganisationsTypName,
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
        enumName: RollenSystemRechtTypName,
        isArray: true,
    })
    public readonly systemrechte: RollenSystemRecht[] = [];

    @AutoMap(() => String)
    @IsOptional()
    @TransformToArray()
    @IsEnum(OrganisationsTyp, { each: true })
    @ArrayUnique()
    @ApiProperty({
        required: false,
        nullable: true,
        enum: OrganisationsTyp,
        enumName: OrganisationsTypName,
        isArray: true,
    })
    public readonly excludeTyp?: OrganisationsTyp[];

    @AutoMap()
    @IsOptional()
    @TransformToArray()
    @ArrayUnique()
    @IsUUID(undefined, { each: true })
    @ApiProperty({
        required: false,
        nullable: true,
        isArray: true,
    })
    public readonly administriertVon?: string[];

    @AutoMap(() => String)
    @IsOptional()
    @TransformToArray()
    @ArrayUnique()
    @IsUUID(undefined, { each: true })
    @ApiProperty({
        required: false,
        nullable: true,
        isArray: true,
        description:
            'Liefert Organisationen mit den angegebenen IDs, selbst wenn andere Filterkriterien nicht zutreffen (ODER-verknüpft mit anderen Kriterien).',
    })
    public readonly organisationIds?: string[];
}
