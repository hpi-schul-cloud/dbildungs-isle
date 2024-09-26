import { BaseEvent } from './base-event.js';
import { OXContextName, OXUserID, OXUserName } from '../types/ox-ids.types.js';
import { PersonID } from '../types/aggregate-ids.types.js';

/**
 * Thrown when ID_OX has been filled in KC for a user after successfully creating OX-account for the user.
 */
export class OxUserAttributesChangedEvent extends BaseEvent {
    public constructor(
        public readonly personId: PersonID,
        public readonly keycloakUsername: string,
        public readonly userId: OXUserID,
        public readonly userName: OXUserName,
        public readonly contextName: OXContextName,
        public readonly emailAddress: string,
    ) {
        super();
    }
}
