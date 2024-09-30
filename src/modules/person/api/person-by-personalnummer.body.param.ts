import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsString } from 'class-validator';

export class PersonByPersonalnummerBodyParams {
    @IsString()
    @ApiProperty({ required: true })
    public readonly personalnummer!: string;

    @IsDate()
    @ApiProperty({
        required: true,
        description: 'Date of the most recent changed Personalnummer',
    })
    public readonly lastModified!: Date;

    @IsString()
    @ApiProperty({ required: true })
    public readonly revision!: string;
}
