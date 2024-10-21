import { ApiProperty } from '@nestjs/swagger';

export class ImportUploadResponse {
    @ApiProperty({
        description: 'The import transaction number. it will be needed to execute the import and download the result',
    })
    public importvorgangId: string;

    @ApiProperty({
        description: 'It states if the import transaction contain errors.',
    })
    public isValid: boolean;

    public constructor(importvorgangId: string, isValid: boolean) {
        this.importvorgangId = importvorgangId;
        this.isValid = isValid;
    }
}
