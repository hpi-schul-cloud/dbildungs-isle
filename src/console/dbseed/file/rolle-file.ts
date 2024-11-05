import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../../../modules/rolle/domain/rolle.enums.js';

export class RolleFile {
    public id?: number;

    public overrideId?: string;

    public name!: string;

    public administeredBySchulstrukturknoten!: number;

    public rollenart!: RollenArt;

    public merkmale!: RollenMerkmal[];

    public systemrechte!: RollenSystemRecht[];

    public serviceProviderIds!: number[];

    public istTechnisch?: boolean;
}
