import { CheckBefristungSpecification } from './befristung-required-bei-rolle-befristungspflicht.js';
import { GleicheRolleAnKlasseWieSchule } from './gleiche-rolle-an-klasse-wie-schule.js';
import { NurLehrUndLernAnKlasse } from './nur-lehr-und-lern-an-klasse.js';
import { OrganisationMatchesRollenart } from './organisation-matches-rollenart.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { Injectable } from '@nestjs/common';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { CheckRollenartSpecification } from './nur-gleiche-rolle.js';

@Injectable()
export class PersonenkontextSpecification {
    public constructor(
        private checkBefristung: CheckBefristungSpecification,
        private gleicheRolleAnKlasseWieSchule: GleicheRolleAnKlasseWieSchule,
        private nurLehNurLehrUndLernAnKlasse: NurLehrUndLernAnKlasse,
        private checkRollenartLern: CheckRollenartSpecification,
        private organisationMatchesRollenart: OrganisationMatchesRollenart,
        private rolleRepo: RolleRepo,
        private organisationRepo: OrganisationRepository,
    ) {}

    public async checkCompliance(personenkontexte: Personenkontext<boolean>[]): Promise<boolean> {
        return [
            await this.checkBefristung.and(this.checkRollenartLern).isSatisfiedBy(personenkontexte),

            await personenkontexte
                .map((pk: Personenkontext<boolean>) =>
                    this.gleicheRolleAnKlasseWieSchule.and(this.nurLehNurLehrUndLernAnKlasse).isSatisfiedBy(pk),
                )
                .reduce(async (l: Promise<boolean>, r: Promise<boolean>) => (await l) && (await r)),
            await personenkontexte
                .map((pk: Personenkontext<boolean>) => this.checkOrgaRolleCompliance(pk))
                .reduce(async (l: Promise<boolean>, r: Promise<boolean>) => (await l) && (await r)),
        ].every((v: boolean) => v);
    }

    private async checkOrgaRolleCompliance(pk: Personenkontext<boolean>): Promise<boolean> {
        const organisation: Option<Organisation<true>> = await this.organisationRepo.findById(pk.organisationId);
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(pk.rolleId);

        if (organisation == null) {
            return false;
        }
        if (rolle == null) {
            return false;
        }

        return this.organisationMatchesRollenart.isSatisfiedBy(organisation, rolle);
    }
}
