import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { Injectable } from '@nestjs/common';

/**
 * Checks if the organisation matches the rollenart.
 *
 * Sysadmins can only exist on LAND or ROOT organisations.
 * LEIT can only exist on Schools.
 * LERN (students) only exist on forms
 * LEHR (teachers) only exist on schools.
 */

@Injectable()
export class OrganisationMatchesRollenart {
    public isSatisfiedBy(organisation: Organisation<true>, rolle: Rolle<true>): boolean {
        if (rolle.rollenart === RollenArt.SYSADMIN)
            return organisation.typ === OrganisationsTyp.LAND || organisation.typ === OrganisationsTyp.ROOT;
        if (rolle.rollenart === RollenArt.LEIT) return organisation.typ === OrganisationsTyp.SCHULE;
        if (rolle.rollenart === RollenArt.LERN)
            return organisation.typ === OrganisationsTyp.SCHULE || organisation.typ === OrganisationsTyp.KLASSE;
        if (rolle.rollenart === RollenArt.LEHR) return organisation.typ === OrganisationsTyp.SCHULE;

        return true;
    }
}
