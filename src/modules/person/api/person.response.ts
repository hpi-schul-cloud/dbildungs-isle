import { PersonNameParams } from './person-name.params.js';
import { PersonBirthParams } from './person-birth.params.js';
import { Vertrauensstufe, VertrauensstufeTypName } from '../domain/person.enums.js';
import { ApiProperty } from '@nestjs/swagger';
import { UserLockParams } from '../../keycloak-administration/api/user-lock.params.js';
import { PersonEmailResponse } from './person-email-response.js';

export class PersonResponse {
    @ApiProperty()
    public id!: string;

    @ApiProperty({ nullable: true })
    public referrer?: string;

    @ApiProperty()
    public mandant: string = '';

    @ApiProperty({ type: PersonNameParams })
    public name!: PersonNameParams;

    @ApiProperty({ type: PersonBirthParams, nullable: true })
    public geburt?: PersonBirthParams;

    @ApiProperty({ nullable: true })
    public readonly stammorganisation?: string;

    @ApiProperty({ nullable: true })
    public geschlecht?: string;

    @ApiProperty({ nullable: true })
    public lokalisierung?: string;

    @ApiProperty({ enum: Vertrauensstufe, enumName: VertrauensstufeTypName, nullable: true })
    public vertrauensstufe?: Vertrauensstufe;

    @ApiProperty()
    public revision!: string;

    @ApiProperty({ description: 'Initiales Benutzerpasswort, muss nach der ersten Anmeldung geändert werden' })
    public startpasswort?: string;

    @ApiProperty({ nullable: true })
    public personalnummer?: string;

    @ApiProperty({ nullable: true })
    public isLocked?: boolean;

    @ApiProperty({ type: UserLockParams, nullable: true })
    public userLock?: UserLockParams;

    @ApiProperty({
        type: Date,
        description: 'Date of the most recent changes for the person',
        required: true,
    })
    public readonly lastModified!: Date;

    @ApiProperty({
        type: PersonEmailResponse,
        nullable: true,
        description:
            'Contains status and address. Returns email-address verified by OX (enabled) if available, otherwise returns most recently updated one (no prioritized status)',
    })
    public readonly email?: PersonEmailResponse;
}
