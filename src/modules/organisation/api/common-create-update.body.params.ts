import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
    OrganisationsTyp,
    OrganisationsTypName,
    Traegerschaft,
    TraegerschaftTypName,
} from '../domain/organisation.enums.js';

export class CommonCreateUpdateOrganisationBodyParams {
    @IsOptional()
    @IsUUID()
    @ApiPropertyOptional()
    public readonly administriertVon?: string;

    @IsOptional()
    @IsUUID()
    @ApiPropertyOptional()
    public readonly zugehoerigZu?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: 'Required, if `typ` is equal to `SCHULE`' })
    public readonly kennung?: string;

    @IsString()
    @ApiProperty({ required: true })
    public readonly name!: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    public readonly namensergaenzung?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    public readonly kuerzel?: string;

    @IsEnum(OrganisationsTyp)
    @ApiProperty({ enum: OrganisationsTyp, enumName: OrganisationsTypName, required: true })
    public readonly typ!: OrganisationsTyp;

    @IsEnum(Traegerschaft)
    @ApiProperty({ enum: Traegerschaft, enumName: TraegerschaftTypName, required: false })
    @IsOptional()
    public traegerschaft?: Traegerschaft;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    public readonly emailAdress?: string;
}
