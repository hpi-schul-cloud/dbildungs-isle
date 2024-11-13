import { ApiProperty } from '@nestjs/swagger';
import { PersonLockOccasion } from '../../person/domain/person.enums.js';

export class UserLockParams {
    @ApiProperty({ nullable: true })
    public readonly personId?: string;

    @ApiProperty({ nullable: true })
    public readonly locked_by?: string;

    @ApiProperty({ nullable: true })
    public readonly created_at?: string;

    @ApiProperty({ nullable: true })
    public readonly locked_until?: string;

    @ApiProperty({ nullable: true })
    public readonly lock_occasion?: PersonLockOccasion;
}
