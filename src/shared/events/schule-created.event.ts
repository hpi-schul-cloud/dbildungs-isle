import { BaseEvent } from './base-event.js';
import { OrganisationID } from '../types/index.js';

export class SchuleCreatedEvent extends BaseEvent {
    public constructor(public readonly organisationId: OrganisationID) {
        super();
    }
}
