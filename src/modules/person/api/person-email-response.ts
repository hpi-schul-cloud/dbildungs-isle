import { ApiProperty } from '@nestjs/swagger';
import { EmailAddressStatus, EmailAddressStatusName } from '../../email/domain/email-address.js';

export class PersonEmailResponse {
    @ApiProperty({ enum: EmailAddressStatus, enumName: EmailAddressStatusName, required: true })
    public readonly status: EmailAddressStatus;

    @ApiProperty({ type: String, required: true })
    public readonly address: string;

    public constructor(status: EmailAddressStatus, address: string) {
        this.status = status;
        this.address = address;
    }
}
