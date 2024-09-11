import { BaseEvent } from './base-event.js';
import { OXContextName, OXUserName } from '../types/ox-ids.types.js';
import { PersonID } from '../types/aggregate-ids.types.js';

/**
 * Thrown when ID_OX has been filled in KC for a user after successfully creating OX-account for the user.
 */
export class OxUserAttributesCreatedEvent extends BaseEvent {
    public constructor(
        public readonly personId: PersonID,
        public readonly keycloakUsername: string,
        public readonly userName: OXUserName,
        public readonly contextName: OXContextName,
        public readonly emailAddress: string,
    ) {
        super();
    }
}
