import { BaseEvent } from './base-event.js';

import { type Personenkontext } from '../../modules/personenkontext/domain/personenkontext.js';
import { Person } from '../../modules/person/domain/person.js';
import { Rolle } from '../../modules/rolle/domain/rolle.js';
import { Organisation } from '../../modules/organisation/domain/organisation.js';
import { PersonenkontextMigrationRuntype } from '../../modules/personenkontext/domain/personenkontext.enums.js';

export class PersonenkontextCreatedMigrationEvent extends BaseEvent {
    public constructor(
        public readonly migrationRunType: PersonenkontextMigrationRuntype,
        public readonly createdKontext: Personenkontext<true>,
        public readonly createdKontextPerson: Person<true>,
        public readonly createdKontextRolle: Rolle<true>,
        public readonly createdKontextOrga: Organisation<true>,
        public readonly email?: string,
    ) {
        super();
    }
}
