import { ApiProperty } from '@nestjs/swagger';
import { ImportDataItem } from '../domain/import-data-item.js';
import { ImportDataItemResponse } from './import-data-item.response.js';

export class ImportUploadResponse {
    @ApiProperty({
        description: 'The import transaction number. it will be needed to execute the import and download the result',
    })
    public importvorgangId: string;

    @ApiProperty({
        description: 'It states if the import transaction contain errors.',
    })
    public isValid: boolean;

    @ApiProperty({
        description: 'The total number of data items in the CSV file.',
    })
    public totalImportDataItems: number;

    @ApiProperty({
        description: 'The total number of data items in the CSV file that are invalid.',
    })
    public totalInvalidImportDataItems: number;

    @ApiProperty({ type: ImportDataItemResponse, isArray: true })
    public invalidImportDataItems: ImportDataItemResponse[];

    public constructor(
        importvorgangId: string,
        isValid: boolean,
        totalImportDataItems: number,
        importDataItems: ImportDataItem<false>[],
    ) {
        this.importvorgangId = importvorgangId;
        this.isValid = isValid;
        this.totalImportDataItems = totalImportDataItems;
        this.totalInvalidImportDataItems = importDataItems.length;
        this.invalidImportDataItems = importDataItems.map(
            (importDataItem: ImportDataItem<false>) => new ImportDataItemResponse(importDataItem),
        );
    }
}
