import { PersonNameParams } from './person-name.params.js';
import { PersonBirthParams } from './person-birth.params.js';
import { Vertrauensstufe, VertrauensstufeTypName } from '../domain/person.enums.js';
import { ApiProperty } from '@nestjs/swagger';
import { LockInfo } from '../domain/person.js';

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

    @ApiProperty({ nullable: true })
    public lockInfo?: LockInfo;
}
