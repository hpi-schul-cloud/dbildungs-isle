import { Injectable } from '@nestjs/common';

import { DomainError, ItsLearningError } from '../../../shared/error/index.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { CreatePersonAction, CreatePersonParams } from '../actions/create-person.action.js';
import { DeletePersonAction } from '../actions/delete-person.action.js';
import { PersonResponse, ReadPersonAction } from '../actions/read-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';

@Injectable()
export class ItslearningPersonRepo {
    public constructor(private readonly itslearningService: ItsLearningIMSESService) {}

    public async readPerson(id: PersonID): Promise<Option<PersonResponse>> {
        const personResult: Result<PersonResponse, DomainError> = await this.itslearningService.send(
            new ReadPersonAction(id),
        );

        if (!personResult.ok) {
            return undefined;
        }

        return personResult.value;
    }

    public async createOrUpdatePerson(params: CreatePersonParams): Promise<Option<DomainError>> {
        const createAction: CreatePersonAction = new CreatePersonAction(params);

        const createResult: Result<void, DomainError> = await this.itslearningService.send(createAction);

        if (!createResult.ok) {
            return createResult.error;
        }

        return undefined;
    }

    public async updateEmail(personId: PersonID, email: string): Promise<Option<DomainError>> {
        const person: Option<PersonResponse> = await this.readPerson(personId);

        // Person is not in itslearning, should not update the e-mail
        if (!person) return new ItsLearningError(`[updateEmail] person with ID ${personId} not found.`);

        return this.createOrUpdatePerson({
            id: personId,
            firstName: person.firstName,
            lastName: person.lastName,
            institutionRoleType: person.institutionRole,
            username: person.username,
            email,
        });
    }

    public async deletePerson(id: PersonID): Promise<Option<DomainError>> {
        const deleteResult: Result<void, DomainError> = await this.itslearningService.send(new DeletePersonAction(id));

        if (!deleteResult.ok) {
            return deleteResult.error;
        }

        return undefined;
    }
}
