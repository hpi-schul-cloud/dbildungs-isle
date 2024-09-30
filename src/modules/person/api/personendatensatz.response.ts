import { ApiProperty } from '@nestjs/swagger';
import { PersonResponse } from './person.response.js';
import { Person } from '../domain/person.js';
import { PersonBirthParams } from './person-birth.params.js';
import { PersonNameParams } from './person-name.params.js';

export class PersonendatensatzResponse {
    @ApiProperty()
    public person!: PersonResponse;

    public constructor(person: Person<true>, withStartPasswort: boolean) {
        const personResponseName: PersonNameParams = {
            familienname: person.familienname,
            vorname: person.vorname,
            initialenfamilienname: person.initialenFamilienname,
            initialenvorname: person.initialenVorname,
            rufname: person.rufname,
            titel: person.nameTitel,
            anrede: person.nameAnrede,
            namenssuffix: person.nameSuffix,
            namenspraefix: person.namePraefix,
            sortierindex: person.nameSortierindex,
        };
        const personResponseBirth: PersonBirthParams = {
            datum: person.geburtsdatum,
            geburtsort: person.geburtsort,
        };
        const personResponse: PersonResponse = {
            id: person.id,
            referrer: person.referrer,
            mandant: person.mandant,
            name: personResponseName,
            geburt: personResponseBirth,
            stammorganisation: person.stammorganisation,
            geschlecht: person.geschlecht,
            lokalisierung: person.lokalisierung,
            vertrauensstufe: person.vertrauensstufe,
            revision: person.revision,
            startpasswort: withStartPasswort === true ? person.newPassword : undefined,
            personalnummer: person.personalnummer,
            isLocked: person.isLocked,
            lockInfo: person.lockInfo,
            lastModified: person.updatedAt,
        };

        this.person = personResponse;
    }
}
