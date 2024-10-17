import { BaseEvent } from './base-event.js';
import { EmailAddressID, PersonID } from '../types/index.js';

/**
 * This event should be triggered when an existing email-address is deactivated for a user and persisted successfully in the database and
 * a new email-address is generated and persisted successfully in the database. E.g. this event can be triggered when a person is renamed.
 * It is used for synchronization of changing (primary) email-address and the process of requesting user-change in OX afterward.
 * It should not be triggered by any OX-related operation.
 */
export class EmailAddressChangedEvent extends BaseEvent {
    public constructor(
        public readonly personId: PersonID,
        public readonly oldEmailAddressId: EmailAddressID,
        public readonly oldAddress: string,
        public readonly newEmailAddressId: EmailAddressID,
        public readonly newAddress: string,
    ) {
        super();
    }
}
