import { AutoMap } from '@automapper/classes';
import { PersonNameParams } from './person-name.params.js';
import { ApiProperty } from '@nestjs/swagger';
import { PersonBirthParams } from './person-birth.params.js';
import { Vertrauensstufe } from '../domain/person.enums.js';

export class PersonResponse {
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
    @ApiProperty({ enum: Vertrauensstufe })
    public vertrauensstufe!: Vertrauensstufe;
}
