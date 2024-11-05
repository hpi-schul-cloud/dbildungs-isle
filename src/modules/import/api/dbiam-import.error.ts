import { ApiProperty } from '@nestjs/swagger';
import { DbiamError, DbiamErrorProps } from '../../../shared/error/dbiam.error.js';

export enum ImportErrorI18nTypes {
    IMPORT_ERROR = 'IMPORT_ERROR',
    CSV_PARSING_ERROR = 'CSV_PARSING_ERROR',
    CSV_FILE_EMPTY_ERROR = 'CSV_FILE_EMPTY_ERROR',
    IMPORT_TEXT_FILE_CREATION_ERROR = 'IMPORT_TEXT_FILE_CREATION_ERROR',
    IMPORT_NUR_LERN_AN_SCHULE_ERROR = 'IMPORT_NUR_LERN_AN_SCHULE_ERROR',
}

export type DbiamImportErrorProps = DbiamErrorProps & {
    i18nKey: ImportErrorI18nTypes;
};

export class DbiamImportError extends DbiamError {
    @ApiProperty({ enum: ImportErrorI18nTypes })
    public override readonly i18nKey: string;

    public constructor(props: DbiamImportErrorProps) {
        super(props);
        this.i18nKey = props.i18nKey;
    }
}
