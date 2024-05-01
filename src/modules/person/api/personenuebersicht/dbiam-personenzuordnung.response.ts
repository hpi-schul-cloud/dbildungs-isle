import { ApiProperty } from '@nestjs/swagger';
import { RolleID } from '../../../../shared/types/index.js';
import { Personenkontext } from '../../../personenkontext/domain/personenkontext.js';
import { Rolle } from '../../../rolle/domain/rolle.js';
import { OrganisationDo } from '../../../organisation/domain/organisation.do.js';
import { OrganisationsTyp, OrganisationsTypName } from '../../../organisation/domain/organisation.enums.js';

export class DBiamPersonenzuordnungResponse {
    @ApiProperty({ type: String })
    public readonly sskId: string;

    @ApiProperty({ type: String })
    public readonly rolleId: RolleID;

    @ApiProperty({ type: String })
    public readonly sskName: string;

    @ApiProperty({ type: String })
    public readonly sskDstNr: string;

    @ApiProperty({ type: String })
    public readonly rolle: string;

    @ApiProperty({ enum: OrganisationsTyp, enumName: OrganisationsTypName, nullable: true })
    public readonly typ?: OrganisationsTyp;

    public constructor(personenkontext: Personenkontext<true>, organisation: OrganisationDo<true>, rolle: Rolle<true>) {
        //use Organisation Aggregate as soon as there is one
        this.sskId = personenkontext.organisationId;
        this.rolleId = personenkontext.rolleId;
        this.sskName = organisation.name!;
        this.sskDstNr = organisation.kennung!;
        this.rolle = rolle.name;
        this.typ = organisation.typ;
    }
}
