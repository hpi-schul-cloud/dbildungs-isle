import { AutoMap } from '@automapper/classes';
import { Rolle, Personenstatus, Jahrgangsstufe } from '../domain/personenkontext.enums.js';
import { CreatedPersonenkontextOrganisationDto } from './created-personenkontext-organisation.dto.js';
import { SichtfreigabeType } from './personen-query.param.js';
import { LoeschungDto } from './loeschung.dto.js';

export class PersonenkontextDto {
    @AutoMap()
    public readonly id!: string;

    @AutoMap()
    public readonly referrer?: string;

    @AutoMap()
    public readonly mandant!: string;

    @AutoMap(() => CreatedPersonenkontextOrganisationDto)
    public readonly organisation!: CreatedPersonenkontextOrganisationDto;

    @AutoMap(() => String)
    public readonly rolle!: Rolle;

    @AutoMap(() => String)
    public readonly personenstatus?: Personenstatus;

    @AutoMap(() => String)
    public readonly jahrgangsstufe?: Jahrgangsstufe;

    @AutoMap(() => String)
    public readonly sichtfreigabe?: SichtfreigabeType;

    @AutoMap(() => LoeschungDto)
    public readonly loeschung?: LoeschungDto;

    @AutoMap()
    public readonly revision!: string;
}
