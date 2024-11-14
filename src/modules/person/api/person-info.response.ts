/* eslint-disable max-classes-per-file */
import { ApiProperty } from '@nestjs/swagger';
import { Vertrauensstufe, VertrauensstufeTypName } from '../domain/person.enums.js';
import { PersonenkontextResponse } from '../../personenkontext/api/response/personenkontext.response.js';
import { PersonNameResponse } from './person-name.response.js';
import { PersonBirthResponse } from './person-birth.response.js';
import { PersonEmailResponse } from './person-email-response.js';

class Person {
    @ApiProperty()
    public readonly id: string;

    @ApiProperty({ nullable: true })
    public readonly referrer?: string;

    @ApiProperty()
    public readonly mandant: string;

    @ApiProperty({ type: PersonNameResponse })
    public readonly name: PersonNameResponse;

    @ApiProperty({ type: PersonBirthResponse, nullable: true })
    public readonly geburt?: PersonBirthResponse;

    @ApiProperty({ nullable: true })
    public readonly stammorganisation?: string;

    @ApiProperty({ nullable: true })
    public readonly geschlecht?: string;

    @ApiProperty({ nullable: true })
    public readonly lokalisierung?: string;

    @ApiProperty({ enum: Vertrauensstufe, enumName: VertrauensstufeTypName, nullable: true })
    public readonly vertrauensstufe?: Vertrauensstufe;

    @ApiProperty()
    public readonly revision: string;

    @ApiProperty({ nullable: true })
    public readonly personalnummer?: string;

    @ApiProperty({ nullable: true })
    public readonly dienststellen?: string[];

    public constructor(props: Readonly<Person>) {
        this.id = props.id;
        this.referrer = props.referrer;
        this.mandant = props.mandant;
        this.name = new PersonNameResponse(props.name);
        this.geburt = new PersonBirthResponse(props.geburt);
        this.stammorganisation = props.stammorganisation;
        this.geschlecht = props.geschlecht;
        this.lokalisierung = props.lokalisierung;
        this.vertrauensstufe = props.vertrauensstufe;
        this.revision = props.revision;
        this.personalnummer = props.personalnummer;
        this.dienststellen = props.dienststellen;
    }
}

export class PersonInfoResponse {
    @ApiProperty()
    public readonly pid: string;

    @ApiProperty()
    public readonly person: Person;

    @ApiProperty({ type: [PersonenkontextResponse] })
    public readonly personenkontexte: PersonenkontextResponse[];

    @ApiProperty({})
    public readonly gruppen: object[];

    @ApiProperty({
        type: PersonEmailResponse,
        nullable: true,
        description:
            'Contains status and address. Returns email-address verified by OX (enabled) if available, otherwise returns most recently updated one (no prioritized status)',
    })
    public readonly email?: PersonEmailResponse;

    public constructor(props: Readonly<PersonInfoResponse>) {
        this.pid = props.pid;
        this.person = new Person(props.person);
        this.personenkontexte = props.personenkontexte.map(
            (kontext: Readonly<PersonenkontextResponse>) => new PersonenkontextResponse(kontext),
        );
        this.gruppen = [];
        this.email = props.email;
    }
}
