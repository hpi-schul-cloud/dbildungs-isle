import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindPersonenkontextSchulstrukturknotenBodyParams {
    @IsNotEmpty()
    @IsUUID()
    @ApiProperty({
        description: 'RolleId used to filter for schulstrukturknoten in personenkontext.',
        required: true,
        nullable: false,
    })
    public readonly rolleId!: string;

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Organisation/SSK name used to filter for schulstrukturknoten in personenkontext.',
        required: false,
        nullable: true,
    })
    public readonly sskName?: string;

    @IsNotEmpty()
    @IsNumber()
    @IsOptional()
    @ApiProperty({
        description: 'The limit of items for the request.',
        required: false,
        nullable: false,
    })
    public readonly limit?: number;
}
