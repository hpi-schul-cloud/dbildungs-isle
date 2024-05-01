import { ApiProperty } from '@nestjs/swagger';
import { OrganisationsTyp, Traegerschaft } from '../domain/organisation.enums.js';
import { Organisation } from '../domain/organisation.js';

export class OrganisationResponse {
    @ApiProperty()
    public readonly id!: string;

    @ApiProperty({ nullable: true })
    public readonly administriertVon?: string;

    @ApiProperty({ nullable: true })
    public readonly kennung?: string;

    @ApiProperty()
    public readonly name!: string;

    @ApiProperty({ nullable: true })
    public readonly namensergaenzung?: string;

    @ApiProperty()
    public readonly kuerzel?: string;

    @ApiProperty({ enum: OrganisationsTyp })
    public readonly typ!: OrganisationsTyp;

    @ApiProperty({ enum: Traegerschaft })
    public traegerschaft?: Traegerschaft;

    public constructor(organisation: Organisation<true>) {
        this.id = organisation.id;
        this.administriertVon = organisation.administriertVon;
        this.kennung = organisation.kennung;
        this.name = organisation.name!;
        this.namensergaenzung = organisation.namensergaenzung;
        this.kuerzel = organisation.kuerzel;
        this.typ = organisation.typ!;
        this.traegerschaft = organisation.traegerschaft;
    }
}
