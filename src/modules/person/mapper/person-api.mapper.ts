import { Injectable } from '@nestjs/common';
import { PersonInfoResponse } from '../api/person-info.response.js';
import { PersonenkontextResponse } from '../../personenkontext/api/response/personenkontext.response.js';

import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { Person } from '../domain/person.js';
import { CreatedPersonenkontextOrganisation } from '../../personenkontext/api/created-personenkontext-organisation.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { LoeschungResponse } from '../api/loeschung.response.js';
import { PersonEmailResponse } from '../api/person-email-response.js';
import { Organisation } from '../../organisation/domain/organisation.js';

@Injectable()
export class PersonApiMapper {
    public async mapToPersonInfoResponse(
        person: Person<true>,
        kontexte: Personenkontext<true>[],
        email: PersonEmailResponse | undefined,
    ): Promise<PersonInfoResponse> {
        const personenkontexte: PersonenkontextResponse[] = await Promise.all(
            kontexte.map((kontext: Personenkontext<true>) => this.mapToPersonenkontextResponse(kontext)),
        );

        const dienststellen: string[] = (
            await Promise.all(kontexte.map((kontext: Personenkontext<true>) => kontext.getOrganisation()))
        ).flatMap((orga: Option<Organisation<true>>) => (orga?.kennung ? [orga.kennung] : []));

        const response: PersonInfoResponse = new PersonInfoResponse({
            pid: person.id,
            person: {
                id: person.id,
                referrer: person.referrer,
                mandant: person.mandant,
                name: {
                    titel: person.nameTitel,
                    anrede: person.nameAnrede,
                    vorname: person.vorname,
                    familiennamen: person.familienname,
                    initialenfamilienname: person.initialenFamilienname,
                    initialenvorname: person.initialenVorname,
                    rufname: person.rufname,
                    namenspraefix: person.namePraefix,
                    namenssuffix: person.nameSuffix,
                    sortierindex: person.nameSortierindex,
                },
                geburt: {
                    datum: person.geburtsdatum,
                    geburtsort: person.geburtsort,
                },
                stammorganisation: person.stammorganisation,
                geschlecht: person.geschlecht,
                lokalisierung: person.lokalisierung,
                vertrauensstufe: person.vertrauensstufe,
                revision: person.revision,
                personalnummer: person.personalnummer,
                dienststellen: dienststellen,
            },
            personenkontexte: personenkontexte,
            gruppen: [], // TODO: if the gruppe module is implemented, this should be filled out with EW-656 / EW-697
            email,
        });

        return response;
    }

    public async mapToPersonenkontextResponse(props: Personenkontext<true>): Promise<PersonenkontextResponse> {
        const rolle: Option<Rolle<true>> = await props.getRolle();
        const response: PersonenkontextResponse = new PersonenkontextResponse({
            id: props.id,
            referrer: props.referrer,
            mandant: props.mandant!,
            organisation: CreatedPersonenkontextOrganisation.new({ id: props.organisationId }),
            rollenart: rolle?.rollenart,
            rollenname: rolle?.name,
            personenstatus: props.personenstatus,
            jahrgangsstufe: props.jahrgangsstufe,
            sichtfreigabe: props.sichtfreigabe,
            loeschung: props.loeschungZeitpunkt
                ? LoeschungResponse.new({ zeitpunkt: props.loeschungZeitpunkt })
                : undefined,
            revision: props.revision,
        });

        return response;
    }
}
