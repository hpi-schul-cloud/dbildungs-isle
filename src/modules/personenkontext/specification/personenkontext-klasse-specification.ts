import { Personenkontext } from '../domain/personenkontext.js';
import { NurLehrUndLernAnKlasse } from './nur-lehr-und-lern-an-klasse.js';
import { GleicheRolleAnKlasseWieSchule } from './gleiche-rolle-an-klasse-wie-schule.js';
import { DomainError } from '../../../shared/error/index.js';
import { NurLehrUndLernAnKlasseError } from './error/nur-lehr-und-lern-an-klasse.error.js';
import { GleicheRolleAnKlasseWieSchuleError } from './error/gleiche-rolle-an-klasse-wie-schule.error.js';
import { CheckRollenartSpecification } from './nur-gleiche-rolle.js';
import { UpdateInvalidRollenartForLernError } from '../domain/error/update-invalid-rollenart-for-lern.error.js';
import { CheckBefristungSpecification } from './befristung-required-bei-rolle-befristungspflicht.js';
import { PersonenkontextBefristungRequiredError } from '../domain/error/personenkontext-befristung-required.error.js';
import { Injectable } from '@nestjs/common';

/**
 * 'This specification is not extending CompositeSpecification, but combines specifications for Personenkontexte
 * referencing Klassen and returns dedicated errors instead of simply true or false.'
 */
@Injectable()
export class PersonenkontextKlasseSpecification {
    public constructor(
        protected readonly nurLehrUndLernAnKlasse: NurLehrUndLernAnKlasse,
        protected readonly gleicheRolleAnKlasseWieSchule: GleicheRolleAnKlasseWieSchule,
        protected readonly nurGleicheRolle: CheckRollenartSpecification,
        protected readonly befristungRequired: CheckBefristungSpecification,
    ) {}

    public async returnsError(p: Personenkontext<boolean>): Promise<Option<DomainError>> {
        if (!(await this.nurGleicheRolle.isSatisfiedBy([p]))) {
            return new UpdateInvalidRollenartForLernError();
        }
        if (!(await this.befristungRequired.isSatisfiedBy([p]))) {
            return new PersonenkontextBefristungRequiredError();
        }
        if (!(await this.nurLehrUndLernAnKlasse.isSatisfiedBy(p))) {
            return new NurLehrUndLernAnKlasseError();
        }
        if (!(await this.gleicheRolleAnKlasseWieSchule.isSatisfiedBy(p))) {
            return new GleicheRolleAnKlasseWieSchuleError();
        }
        return undefined;
    }
}
