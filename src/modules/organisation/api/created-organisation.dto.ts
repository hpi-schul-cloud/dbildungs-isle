import { AutoMap } from '@automapper/classes';
import { OrganisationsTyp, Traegerschaft } from '../domain/organisation.enums.js';

export class CreatedOrganisationDto {
    @AutoMap()
    public readonly id!: string;

    @AutoMap()
    public readonly administriertVon?: string;

    @AutoMap()
    public readonly kennung?: string;

    @AutoMap()
    public readonly name!: string;

    @AutoMap()
    public readonly namensergaenzung?: string;

    @AutoMap()
    public readonly kuerzel?: string;

    @AutoMap(() => String)
    public readonly typ!: OrganisationsTyp;

    @AutoMap(() => String)
    public traegerschaft?: Traegerschaft;
}
