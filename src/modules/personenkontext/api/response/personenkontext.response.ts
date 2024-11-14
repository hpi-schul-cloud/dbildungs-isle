import { ApiProperty } from '@nestjs/swagger';
import { Jahrgangsstufe, Personenstatus, SichtfreigabeType } from '../../domain/personenkontext.enums.js';
import { CreatedPersonenkontextOrganisation } from '../created-personenkontext-organisation.js';
import { LoeschungResponse } from '../../../person/api/loeschung.response.js';
import { RollenArt } from '../../../rolle/domain/rolle.enums.js';

export class PersonenkontextResponse {
    @ApiProperty()
    public id!: string;

    @ApiProperty({ nullable: true })
    public referrer?: string;

    @ApiProperty()
    public mandant!: string;

    @ApiProperty({ type: CreatedPersonenkontextOrganisation })
    public organisation!: CreatedPersonenkontextOrganisation;

    @ApiProperty({ nullable: true })
    public rollenart?: RollenArt;

    @ApiProperty({ nullable: true })
    public rollenname?: string;

    @ApiProperty({ enum: Personenstatus, nullable: true })
    public personenstatus?: Personenstatus;

    @ApiProperty({ enum: Jahrgangsstufe, nullable: true })
    public jahrgangsstufe?: Jahrgangsstufe;

    @ApiProperty({ enum: SichtfreigabeType, nullable: true })
    public sichtfreigabe?: SichtfreigabeType;

    @ApiProperty({ type: LoeschungResponse, nullable: true })
    public loeschung?: LoeschungResponse;

    @ApiProperty()
    public revision!: string;

    public constructor(props: Readonly<PersonenkontextResponse>) {
        this.id = props.id;
        this.referrer = props.referrer;
        this.mandant = props.mandant!;
        this.organisation = props.organisation;
        this.personenstatus = props.personenstatus;
        this.jahrgangsstufe = props.jahrgangsstufe;
        this.sichtfreigabe = props.sichtfreigabe;
        this.loeschung = props.loeschung;
        this.revision = props.revision;
        this.rollenart = props.rollenart;
        this.rollenname = props.rollenname;
    }
}
