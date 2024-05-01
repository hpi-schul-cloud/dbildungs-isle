import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PersonPermissions } from './person-permissions.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';

@Injectable()
export class PersonPermissionsRepo {
    public constructor(
        private personRepo: PersonRepository,
        private personenkontextRepo: DBiamPersonenkontextRepo,
        private organisationRepo: OrganisationRepo,
        private rollenRepo: RolleRepo,
    ) {}

    public async loadPersonPermissions(keycloakUserId: string): Promise<PersonPermissions> {
        const person: Option<Person<true>> = await this.personRepo.findByKeycloakUserId(keycloakUserId);
        if (!person) {
            throw new UnauthorizedException();
        }

        return new PersonPermissions(this.personenkontextRepo, this.organisationRepo, this.rollenRepo, person);
    }
}
