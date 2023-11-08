import { AutoMap } from '@automapper/classes';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';
import { PersonNameDto } from './person-name.dto.js';
import { PersonGeburtDto } from './person-geburt.dto.js';

export class PersonDto {
    @AutoMap()
    public id!: string;

    @AutoMap(() => Date)
    public createdAt!: Date;

    @AutoMap(() => Date)
    public updatedAt!: Date;

    @AutoMap()
    public keycloakUserId!: string;

    @AutoMap()
    public referrer?: string;

    @AutoMap()
    public mandant: string = '';

    @AutoMap()
    public stammorganisation?: string;

    @AutoMap(() => PersonNameDto)
    public name!: PersonNameDto;

    @AutoMap(() => PersonGeburtDto)
    public geburt!: PersonGeburtDto;

    @AutoMap(() => String)
    public geschlecht?: Geschlecht;

    @AutoMap()
    public lokalisierung?: string = 'de-DE';

    @AutoMap(() => String)
    public vertrauensstufe?: Vertrauensstufe;

    @AutoMap()
    public auskunftssperre?: boolean;
}
