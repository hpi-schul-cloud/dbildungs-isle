import { PersonRenamedEvent } from './person-renamed-event.js';

/**
 * This event is used to chain LdapEventHandler and EmailEventHandler, so operations as result
 * of renaming a user are executed after each other rather than in parallel.
 */
export class LdapPersonEntryRenamedEvent extends PersonRenamedEvent {
    public static fromPersonRenamedEvent(personRenamedEvent: PersonRenamedEvent): LdapPersonEntryRenamedEvent {
        return new LdapPersonEntryRenamedEvent(
            personRenamedEvent.personId,
            personRenamedEvent.vorname,
            personRenamedEvent.familienname,
            personRenamedEvent.referrer,
            personRenamedEvent.oldReferrer,
            personRenamedEvent.oldVorname,
            personRenamedEvent.oldFamilienname,
        );
    }
}
