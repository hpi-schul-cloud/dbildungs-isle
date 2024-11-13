import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ImportvorgangByIdParams {
    @IsUUID()
    @ApiProperty({
        description: 'The id of an import transaction',
        required: true,
        nullable: false,
    })
    public importvorgangId!: string;
}
