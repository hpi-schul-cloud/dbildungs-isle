import { AutoMap } from '@automapper/classes';
import { Jahrgangsstufe, Personenstatus, Rolle } from '../domain/personenkontext.enums.js';
import { CreatedPersonenkontextOrganisationDto } from './created-personenkontext-organisation.dto.js';
import { LoeschungDto } from './loeschung.dto.js';
import { SichtfreigabeType } from './personen-query.param.js';

export class CreatedPersonenkontextDto {
    @AutoMap()
    public readonly id!: string;

    @AutoMap()
    public readonly referrer?: string;

    @AutoMap()
    public readonly mandant!: string;

    @AutoMap()
    public readonly organisation!: CreatedPersonenkontextOrganisationDto;

    @AutoMap()
    public readonly rolle!: Rolle;

    @AutoMap()
    public readonly personenstatus?: Personenstatus;

    @AutoMap()
    public readonly jahrgangsstufe?: Jahrgangsstufe;

    @AutoMap(() => String)
    public readonly sichtfreigabe?: SichtfreigabeType;

    @AutoMap(() => LoeschungDto)
    public readonly loeschung?: LoeschungDto;

    @AutoMap()
    public readonly revision!: string;
}
