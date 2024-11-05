import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

import { IsDIN91379A } from '../../../shared/util/din-91379-validation.js';
import { ImportDomainErrorI18nTypes } from './import-i18n-errors.js';

export class CSVImportDataItemDTO {
    @IsDIN91379A({ message: ImportDomainErrorI18nTypes.IMPORT_DATA_ITEM_NACHNAME_IS_INVALID })
    @MinLength(2, { message: ImportDomainErrorI18nTypes.IMPORT_DATA_ITEM_NACHNAME_IS_TOO_SHORT })
    @ApiProperty({ required: true })
    public readonly nachname!: string;

    @IsDIN91379A({ message: ImportDomainErrorI18nTypes.IMPORT_DATA_ITEM_VORNAME_IS_INVALID })
    @MinLength(2, { message: ImportDomainErrorI18nTypes.IMPORT_DATA_ITEM_VORNAME_IS_TOO_SHORT })
    @ApiProperty({ required: true })
    public readonly vorname!: string;

    @IsOptional()
    @MinLength(2, { message: ImportDomainErrorI18nTypes.IMPORT_DATA_ITEM_KLASSE_IS_TOO_SHORT })
    @ApiProperty({ nullable: true })
    public readonly klasse?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false })
    public readonly personalnummer?: string;
}
