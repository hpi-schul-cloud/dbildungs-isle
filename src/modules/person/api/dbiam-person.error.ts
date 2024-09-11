import { ApiProperty } from '@nestjs/swagger';
import { DbiamError, DbiamErrorProps } from '../../../shared/error/dbiam.error.js';

export enum PersonErrorI18nTypes {
    PERSON_ERROR = 'PERSON_ERROR',
    VORNAME_ENTHAELT_LEERZEICHEN = 'VORNAME_ENTHAELT_LEERZEICHEN',
    FAMILIENNAME_ENTHAELT_LEERZEICHEN = 'FAMILIENNAME_ENTHAELT_LEERZEICHEN',
    PERSON_NOT_FOUND = 'PERSON_NOT_FOUND',
    DOWNSTREAM_UNREACHABLE = 'DOWNSTREAM_UNREACHABLE',
}

export type DbiamPersonErrorProps = DbiamErrorProps & {
    i18nKey: PersonErrorI18nTypes;
};

export class DbiamPersonError extends DbiamError {
    @ApiProperty({ enum: PersonErrorI18nTypes })
    public override readonly i18nKey: string;

    public constructor(props: DbiamPersonErrorProps) {
        super(props);
        this.i18nKey = props.i18nKey;
    }
}
