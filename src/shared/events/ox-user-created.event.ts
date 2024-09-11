import { BaseEvent } from './base-event.js';
import { OXContextID, OXContextName, OXUserID, OXUserName } from '../types/ox-ids.types.js';

export class OxUserCreatedEvent extends BaseEvent {
    public constructor(
        public readonly personId: string,
        public readonly keycloakUsername: string,
        public readonly userId: OXUserID,
        public readonly userName: OXUserName,
        public readonly contextId: OXContextID,
        public readonly contextName: OXContextName,
        public readonly primaryEmail: string,
    ) {
        super();
    }
}
