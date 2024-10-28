import { ApiProperty } from '@nestjs/swagger';

export class UserLockParams {
    @ApiProperty({ nullable: true })
    public readonly personId?: string;

    @ApiProperty({ nullable: true })
    public readonly locked_by?: string;

    @ApiProperty({ nullable: true })
    public readonly created_at?: string;

    @ApiProperty({ nullable: true })
    public readonly locked_until?: string;
}
