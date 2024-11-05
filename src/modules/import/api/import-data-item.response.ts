import { ApiProperty } from '@nestjs/swagger';
import { ImportDataItem } from '../domain/import-data-item.js';

export class ImportDataItemResponse {
    @ApiProperty()
    public nachname: string;

    @ApiProperty()
    public vorname: string;

    @ApiProperty({ nullable: true })
    public klasse?: string;

    @ApiProperty({ type: 'string', isArray: true })
    public validationErrors?: string[];

    public constructor(importDataItem: ImportDataItem<false>) {
        this.nachname = importDataItem.nachname;
        this.vorname = importDataItem.vorname;
        this.klasse = importDataItem.klasse;
        this.validationErrors = importDataItem.validationErrors;
    }
}
