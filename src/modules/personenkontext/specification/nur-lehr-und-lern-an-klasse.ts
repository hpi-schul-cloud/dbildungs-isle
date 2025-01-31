import { CompositeSpecification } from '../../specification/specifications.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { Injectable } from '@nestjs/common';

/**
 * Only needs to be checked when referenced organisation is of type KLASSE.
 */
@Injectable()
export class NurLehrUndLernAnKlasse extends CompositeSpecification<Personenkontext<boolean>> {
    public constructor(
        private readonly organisationRepository: OrganisationRepository,
        private readonly rolleRepo: RolleRepo,
    ) {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async isSatisfiedBy(p: Personenkontext<boolean>): Promise<boolean> {
        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(p.organisationId);
        if (!organisation) return false;
        if (organisation.typ !== OrganisationsTyp.KLASSE) return true;

        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(p.rolleId);
        if (!rolle) return false;
        return rolle.rollenart === RollenArt.LEHR || rolle.rollenart === RollenArt.LERN;
    }
}
