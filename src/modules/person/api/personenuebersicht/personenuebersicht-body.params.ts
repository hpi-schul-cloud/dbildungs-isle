import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PersonID } from '../../../../shared/types/aggregate-ids.types.js';

export class PersonenuebersichtBodyParams {
    @ApiProperty({
        description: 'An array of IDs for the persons.',
        type: [String],
    })
    @IsString({ each: true })
    @ApiProperty({ required: true })
    public readonly personIds!: PersonID[];
}
