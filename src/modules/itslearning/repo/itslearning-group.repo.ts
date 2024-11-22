import { Injectable } from '@nestjs/common';

import { DomainError } from '../../../shared/error/index.js';
import { OrganisationID } from '../../../shared/types/index.js';
import { CreateGroupAction } from '../actions/create-group.action.js';
import { CreateGroupParams } from '../actions/create-group.params.js';
import { CreateGroupsAction } from '../actions/create-groups.action.js';
import { DeleteGroupAction } from '../actions/delete-group.action.js';
import { GroupResponse, ReadGroupAction } from '../actions/read-group.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';

@Injectable()
export class ItslearningGroupRepo {
    public constructor(private readonly itslearningService: ItsLearningIMSESService) {}

    public async readGroup(id: OrganisationID): Promise<Option<GroupResponse>> {
        const groupResult: Result<GroupResponse, DomainError> = await this.itslearningService.send(
            new ReadGroupAction(id),
        );

        if (!groupResult.ok) {
            return undefined;
        }

        return groupResult.value;
    }

    public async createOrUpdateGroup(params: CreateGroupParams): Promise<Option<DomainError>> {
        const createAction: CreateGroupAction = new CreateGroupAction(params);

        const createResult: Result<void, DomainError> = await this.itslearningService.send(createAction);

        if (!createResult.ok) {
            return createResult.error;
        }

        return undefined;
    }

    public async createOrUpdateGroups(params: CreateGroupParams[]): Promise<Option<DomainError>> {
        const createAction: CreateGroupsAction = new CreateGroupsAction(params);

        const createResult: Result<void, DomainError> = await this.itslearningService.send(createAction);

        if (!createResult.ok) {
            return createResult.error;
        }

        return undefined;
    }

    public async deleteGroup(id: OrganisationID): Promise<Option<DomainError>> {
        const deleteResult: Result<void, DomainError> = await this.itslearningService.send(new DeleteGroupAction(id));

        if (!deleteResult.ok) {
            return deleteResult.error;
        }

        return undefined;
    }
}
