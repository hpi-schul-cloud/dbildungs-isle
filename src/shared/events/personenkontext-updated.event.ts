import { BaseEvent } from './base-event.js';

import { type Organisation } from '../../modules/organisation/domain/organisation.js';
import { type Person } from '../../modules/person/domain/person.js';
import { type Personenkontext } from '../../modules/personenkontext/domain/personenkontext.js';
import { type Rolle } from '../../modules/rolle/domain/rolle.js';
import { type ServiceProvider } from '../../modules/service-provider/domain/service-provider.js';
import {
    type PersonenkontextEventKontextData,
    type PersonenkontextEventPersonData,
} from './personenkontext-event.types.js';
import { RollenArt } from '../../modules/rolle/domain/rolle.enums.js';

export type PersonenkontextUpdatedPersonData = PersonenkontextEventPersonData;

export type PersonenkontextUpdatedData = PersonenkontextEventKontextData;

function mapPersonToData(person: Person<true>, ldapEntryUUID?: string): PersonenkontextUpdatedPersonData {
    return {
        id: person.id,
        vorname: person.vorname,
        familienname: person.familienname,
        referrer: person.referrer,
        ldapEntryUUID: ldapEntryUUID,
        keycloakUserId: person.keycloakUserId,
        email: person.email,
    };
}

function mapPersonenkontextAndRolleAggregateToData([pk, orga, rolle]: [
    Personenkontext<true>,
    Organisation<true>,
    Rolle<true>,
]): PersonenkontextEventKontextData {
    return {
        id: pk.id,
        rolleId: pk.rolleId,
        rolle: rolle.rollenart,
        orgaId: pk.organisationId,
        orgaTyp: orga.typ,
        orgaKennung: orga.kennung,
        isItslearningOrga: orga.itslearningEnabled,
        serviceProviderExternalSystems: rolle.serviceProviderData.map((sp: ServiceProvider<true>) => sp.externalSystem),
    };
}

export class PersonenkontextUpdatedEvent extends BaseEvent {
    public constructor(
        public readonly person: PersonenkontextEventPersonData,
        public readonly newKontexte: PersonenkontextEventKontextData[],
        public readonly removedKontexte: PersonenkontextEventKontextData[],
        /**
         * Property @currentKontexte contains all Personenkontexte for a person at the time of event-creation,
         * inclusive the Personenkontexte which shall be created, exclusive the Personenkontexte which shall be removed.
         * Therefore, instances of this event-type can be interpreted as the most recent versions of Personenkontexte for a person.
         */
        public readonly currentKontexte: PersonenkontextEventKontextData[],
    ) {
        super();
    }

    public static fromPersonenkontexte(
        person: Person<true>,
        newKontexte: [Personenkontext<true>, Organisation<true>, Rolle<true>][],
        removedKontexte: [Personenkontext<true>, Organisation<true>, Rolle<true>][],
        currentKontexte: [Personenkontext<true>, Organisation<true>, Rolle<true>][],
        ldapEntryUUID?: string,
    ): PersonenkontextUpdatedEvent {
        return new PersonenkontextUpdatedEvent(
            mapPersonToData(person, ldapEntryUUID),
            newKontexte.map(mapPersonenkontextAndRolleAggregateToData),
            removedKontexte.map(mapPersonenkontextAndRolleAggregateToData),
            currentKontexte.map(mapPersonenkontextAndRolleAggregateToData),
        );
    }

    /**
     * Check if @currentKontexte contains at least one PersonenkontextEventKontextData which satisfies the condition
     * 'rolle is LEHR'.
     */
    public containsAnyCurrentPKWithRollenartLehr(): boolean {
        return this.currentKontexte.some(
            (pkEventKontextData: PersonenkontextEventKontextData) => pkEventKontextData.rolle === RollenArt.LEHR,
        );
    }
}
