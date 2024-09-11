import { ApiProperty } from '@nestjs/swagger';

export class PersonLockResponse {
    @ApiProperty()
    public readonly message: string;

    public constructor(message: string) {
        this.message = message;
    }
}
