import { AutoMap } from '@automapper/classes';
import { PersonNameParams } from './person-name.params.js';
import { ApiProperty } from '@nestjs/swagger';
import { PersonBirthParams } from './person-birth.params.js';
import { Vertrauensstufe, VertrauensstufeTypName } from '../domain/person.enums.js';

export class PersonResponseAutomapper {
    @AutoMap()
    @ApiProperty()
    public id!: string;

    @AutoMap()
    @ApiProperty()
    public referrer?: string;

    @AutoMap()
    @ApiProperty()
    public mandant: string = '';

    @AutoMap(() => PersonNameParams)
    @ApiProperty({ type: PersonNameParams })
    public name!: PersonNameParams;

    @AutoMap(() => PersonBirthParams)
    @ApiProperty({ type: PersonBirthParams })
    public geburt!: PersonBirthParams;

    @AutoMap()
    @ApiProperty()
    public readonly stammorganisation?: string;

    @AutoMap()
    @ApiProperty()
    public geschlecht!: string;

    @AutoMap()
    @ApiProperty()
    public lokalisierung!: string;

    @AutoMap(() => String)
    @ApiProperty({ enum: Vertrauensstufe, enumName: VertrauensstufeTypName })
    public vertrauensstufe!: Vertrauensstufe;

    @AutoMap()
    @ApiProperty()
    public revision!: string;

    @AutoMap()
    @ApiProperty({ description: 'Initiales Benutzerpasswort, muss nach der ersten Anmeldung geändert werden' })
    public startpasswort?: string;

    @AutoMap()
    @ApiProperty()
    public personalnummer?: string;
}
