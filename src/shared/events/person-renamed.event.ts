import { BaseEvent } from './base-event.js';
import { PersonID } from '../types/index.js';

export class PersonRenamedEvent extends BaseEvent {
    public constructor(
        public readonly personId: PersonID,
        public readonly emailAddress?: string,
    ) {
        super();
    }
}
