import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/error/index.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Personenkontext } from './personenkontext.js';
import { PersonenkontextWorkflowFactory } from './personenkontext-workflow.factory.js';
import { PersonenkontextWorkflowAggregate } from './personenkontext-workflow.js';
import { Person } from '../../person/domain/person.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { PersonFactory } from '../../person/domain/person.factory.js';
import { DbiamPersonenkontextFactory } from './dbiam-personenkontext.factory.js';
import { PersonenkontexteUpdateError } from './error/personenkontexte-update.error.js';
import { PersonenkontexteUpdate } from './personenkontexte-update.js';
import { PermissionsOverride } from '../../../shared/permissions/permissions-override.js';
import { DbiamCreatePersonenkontextBodyParams } from '../api/param/dbiam-create-personenkontext.body.params.js';

export type PersonPersonenkontext = {
    person: Person<true>;
    personenkontexte: Personenkontext<true>[];
};

@Injectable()
export class PersonenkontextCreationService {
    public constructor(
        private readonly personRepository: PersonRepository,
        private readonly personFactory: PersonFactory,
        private readonly personenkontextWorkflowFactory: PersonenkontextWorkflowFactory,
        private readonly dbiamPersonenkontextFactory: DbiamPersonenkontextFactory,
    ) {}

    public async createPersonWithPersonenkontexte(
        permissions: PersonPermissions,
        vorname: string,
        familienname: string,
        createPersonenkontexte: DbiamCreatePersonenkontextBodyParams[],
        personalnummer?: string,
        befristung?: Date,
    ): Promise<PersonPersonenkontext | DomainError> {
        const person: Person<false> | DomainError = await this.personFactory.createNew({
            vorname: vorname,
            familienname: familienname,
            personalnummer: personalnummer,
        });
        if (person instanceof DomainError) {
            return person;
        }

        const anlage: PersonenkontextWorkflowAggregate = this.personenkontextWorkflowFactory.createNew();
        /* eslint-disable no-await-in-loop */
        for (const createPersonenkontext of createPersonenkontexte) {
            anlage.initialize(createPersonenkontext.organisationId, createPersonenkontext.rolleId);
            const canCommit: DomainError | boolean = await anlage.canCommit(permissions);
            if (canCommit instanceof DomainError) {
                return canCommit;
            }
        }

        //Save Person
        const savedPerson: DomainError | Person<true> = await this.personRepository.create(person);

        if (savedPerson instanceof DomainError) {
            return savedPerson;
        }

        const pkUpdate: PersonenkontexteUpdate = this.dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
            savedPerson.id,
            new Date(),
            0,
            createPersonenkontexte.map((createPersonenkontext: DbiamCreatePersonenkontextBodyParams) => ({
                personId: savedPerson.id,
                organisationId: createPersonenkontext.organisationId,
                rolleId: createPersonenkontext.rolleId,
                befristung,
            })),
            new PermissionsOverride(permissions).grantPersonModifyPermission(savedPerson.id),
        );

        const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await pkUpdate.update();
        if (updateResult instanceof DomainError) {
            return updateResult;
        }

        if (updateResult.length !== createPersonenkontexte.length) {
            return new PersonenkontexteUpdateError('The number of updated personenkontexte is invalid');
        }

        return {
            person: savedPerson,
            personenkontexte: updateResult,
        };
    }
}
