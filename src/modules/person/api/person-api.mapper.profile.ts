import {
    Converter,
    Mapper,
    MappingProfile,
    convertUsing,
    createMap,
    forMember,
    ignore,
    mapFrom,
} from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { UserDo } from '../../keycloak-administration/index.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { CreatePersonDto } from './create-person.dto.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonenkontextBodyParams } from './create-personenkontext.body.params.js';
import { CreatePersonenkontextDto } from './create-personenkontext.dto.js';
import { CreatedPersonenkontextOrganisationDto } from './created-personenkontext-organisation.dto.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { FindPersonendatensatzDto } from './find-personendatensatz.dto.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextByIdParams } from './find-personenkontext-by-id.params.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { LoeschungDto } from './loeschung.dto.js';
import { LoeschungResponse } from './loeschung.response.js';
import { PersonBirthParams } from './person-birth.params.js';
import { PersonGeburtDto } from './person-geburt.dto.js';
import { PersonNameDto } from './person-name.dto.js';
import { PersonNameParams } from './person-name.params.js';
import { PersonDto } from './person.dto.js';
import { PersonResponse } from './person.response.js';
import { PersonenQueryParams, SichtfreigabeType } from './personen-query.param.js';
import { PersonendatensatzDto } from './personendatensatz.dto.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonenkontextQueryParams } from './personenkontext-query.params.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { PersonenkontextResponse } from './personenkontext.response.js';

export const personVisibilityToBooleanConverter: Converter<SichtfreigabeType, boolean> = {
    convert(source: SichtfreigabeType) {
        switch (source) {
            case SichtfreigabeType.JA:
                return true;
            case SichtfreigabeType.NEIN:
            default:
                return false;
        }
    },
};

@Injectable()
export class PersonApiMapperProfile extends AutomapperProfile {
    public constructor(@Inject(getMapperToken()) mapper: Mapper) {
        super(mapper);
    }

    public override get profile(): MappingProfile {
        return (mapper: Mapper) => {
            createMap(
                mapper,
                CreatePersonBodyParams,
                CreatePersonDto,
                forMember(
                    (dest: CreatePersonDto) => dest.familienname,
                    mapFrom((src: CreatePersonBodyParams) => src.name.familienname),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.vorname,
                    mapFrom((src: CreatePersonBodyParams) => src.name.vorname),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.nameTitel,
                    mapFrom((src: CreatePersonBodyParams) => src.name.titel),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.nameAnrede,
                    mapFrom((src: CreatePersonBodyParams) => src.name.anrede),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.namePraefix,
                    mapFrom((src: CreatePersonBodyParams) => src.name.namenspraefix),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.nameSuffix,
                    mapFrom((src: CreatePersonBodyParams) => src.name.namenssuffix),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.initialenFamilienname,
                    mapFrom((src: CreatePersonBodyParams) => src.name.initialenfamilienname),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.initialenVorname,
                    mapFrom((src: CreatePersonBodyParams) => src.name.initialenvorname),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.rufname,
                    mapFrom((src: CreatePersonBodyParams) => src.name.rufname),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.geburtsdatum,
                    mapFrom((src: CreatePersonBodyParams) => src.geburt?.datum),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.geburtsort,
                    mapFrom((src: CreatePersonBodyParams) => src.geburt?.geburtsort),
                ),
            );
            createMap(
                mapper,
                CreatePersonDto,
                PersonDo,
                forMember((dest: PersonDo<boolean>) => dest.keycloakUserId, ignore()),
                forMember((dest: PersonDo<boolean>) => dest.id, ignore()),
                forMember((dest: PersonDo<boolean>) => dest.createdAt, ignore()),
                forMember((dest: PersonDo<boolean>) => dest.updatedAt, ignore()),
            );
            createMap(
                mapper,
                PersonDo,
                PersonendatensatzResponse,
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.id,
                    mapFrom((src: PersonDo<true>) => src.id),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.mandant,
                    mapFrom((src: PersonDo<true>) => src.mandant),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.referrer,
                    mapFrom((src: PersonDo<true>) => src.referrer),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.vorname,
                    mapFrom((src: PersonDo<true>) => src.vorname),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.rufname,
                    mapFrom((src: PersonDo<true>) => src.rufname),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.familienname,
                    mapFrom((src: PersonDo<true>) => src.familienname),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.initialenvorname,
                    mapFrom((src: PersonDo<true>) => src.initialenVorname),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.initialenfamilienname,
                    mapFrom((src: PersonDo<true>) => src.initialenFamilienname),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.sortierindex,
                    mapFrom((src: PersonDo<true>) => src.nameSortierindex),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.geburt.datum,
                    mapFrom((src: PersonDo<true>) => src.geburtsdatum),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.geburt.geburtsort,
                    mapFrom((src: PersonDo<true>) => src.geburtsort),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.vertrauensstufe,
                    mapFrom((src: PersonDo<true>) => src.vertrauensstufe),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.geschlecht,
                    mapFrom((src: PersonDo<true>) => src.geschlecht),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.lokalisierung,
                    mapFrom((src: PersonDo<true>) => src.lokalisierung),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.stammorganisation,
                    mapFrom((src: PersonDo<true>) => src.stammorganisation),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.anrede,
                    mapFrom((src: PersonDo<true>) => src.nameAnrede),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.namenssuffix,
                    mapFrom((src: PersonDo<true>) => src.nameSuffix),
                ),
                forMember(
                    (dest: PersonendatensatzResponse) => dest.person.name.namenspraefix,
                    mapFrom((src: PersonDo<true>) => src.namePraefix),
                ),
            );
            createMap(mapper, PersonenQueryParams, FindPersonendatensatzDto);
            createMap(
                mapper,
                FindPersonendatensatzDto,
                PersonDo<false>,
                forMember((dest: PersonDo<false>) => dest.id, ignore()),
                forMember((dest: PersonDo<false>) => dest.createdAt, ignore()),
                forMember((dest: PersonDo<false>) => dest.updatedAt, ignore()),
                forMember((dest: PersonDo<false>) => dest.keycloakUserId, ignore()),
                forMember((dest: PersonDo<false>) => dest.mandant, ignore()),
                forMember((dest: PersonDo<false>) => dest.stammorganisation, ignore()),
                forMember((dest: PersonDo<false>) => dest.initialenFamilienname, ignore()),
                forMember((dest: PersonDo<false>) => dest.initialenVorname, ignore()),
                forMember((dest: PersonDo<false>) => dest.rufname, ignore()),
                forMember((dest: PersonDo<false>) => dest.nameTitel, ignore()),
                forMember((dest: PersonDo<false>) => dest.nameAnrede, ignore()),
                forMember((dest: PersonDo<false>) => dest.namePraefix, ignore()),
                forMember((dest: PersonDo<false>) => dest.nameSuffix, ignore()),
                forMember((dest: PersonDo<false>) => dest.nameSortierindex, ignore()),
                forMember((dest: PersonDo<false>) => dest.geburtsdatum, ignore()),
                forMember((dest: PersonDo<false>) => dest.geburtsort, ignore()),
                forMember((dest: PersonDo<false>) => dest.geschlecht, ignore()),
                forMember((dest: PersonDo<false>) => dest.lokalisierung, ignore()),
                forMember((dest: PersonDo<false>) => dest.vertrauensstufe, ignore()),
                forMember((dest: PersonDo<false>) => dest.auskunftssperre, ignore()),
            );

            createMap(mapper, CreatePersonDto, UserDo);

            createMap(
                mapper,
                CreatePersonenkontextBodyParams,
                CreatePersonenkontextDto,
                forMember((dest: CreatePersonenkontextDto) => dest.personId, ignore()),
            );

            createMap(
                mapper,
                CreatePersonenkontextDto,
                PersonenkontextDo,
                forMember((dest: PersonenkontextDo<boolean>) => dest.id, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.createdAt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.updatedAt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.mandant, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.organisation, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.loeschungZeitpunkt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.revision, ignore()),
            );

            createMap(
                mapper,
                PersonenkontextDo,
                CreatedPersonenkontextDto,
                forMember(
                    (dest: PersonenkontextDto) => dest.loeschung,
                    mapFrom((src: PersonenkontextDo<boolean>) =>
                        src.loeschungZeitpunkt ? new LoeschungDto({ zeitpunkt: src.loeschungZeitpunkt }) : undefined,
                    ),
                ),
            );

            createMap(mapper, OrganisationDo, CreatedPersonenkontextOrganisationDto);

            createMap(mapper, CreatedPersonenkontextDto, PersonenkontextResponse);

            createMap(
                mapper,
                PersonenkontextQueryParams,
                FindPersonenkontextDto,
                forMember((dest: FindPersonenkontextDto) => dest.personId, ignore()),
            );

            createMap(
                mapper,
                FindPersonenkontextDto,
                PersonenkontextDo,
                forMember((dest: PersonenkontextDo<boolean>) => dest.createdAt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.updatedAt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.mandant, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.organisation, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.jahrgangsstufe, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.loeschungZeitpunkt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.revision, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.id, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.createdAt, ignore()),
                forMember((dest: PersonenkontextDo<boolean>) => dest.updatedAt, ignore()),
                forMember(
                    (dest: PersonenkontextDo<boolean>) => dest.id,
                    mapFrom((src: FindPersonenkontextDto) => src.personId),
                ),
                forMember(
                    (dest: PersonenkontextDo<boolean>) => dest.sichtfreigabe,
                    convertUsing(
                        personVisibilityToBooleanConverter,
                        (src: FindPersonenkontextDto) => src.sichtfreigabe,
                    ),
                ),
            );

            createMap(mapper, FindPersonenkontextByIdParams, FindPersonenkontextByIdDto);

            createMap(
                mapper,
                PersonenkontextDo,
                PersonenkontextDto,
                forMember(
                    (dest: PersonenkontextDto) => dest.loeschung,
                    mapFrom((src: PersonenkontextDo<boolean>) =>
                        src.loeschungZeitpunkt ? new LoeschungDto({ zeitpunkt: src.loeschungZeitpunkt }) : undefined,
                    ),
                ),
            );

            createMap(
                mapper,
                PersonDo,
                PersonDto,
                forMember(
                    (dest: PersonDto) => dest.name,
                    mapFrom(
                        (src: PersonDo<boolean>) =>
                            new PersonNameDto({
                                vorname: src.vorname,
                                familienname: src.familienname,
                                initialenfamilienname: src.initialenFamilienname,
                                initialenvorname: src.initialenVorname,
                                rufname: src.rufname,
                                titel: src.nameTitel,
                                anrede: src.nameAnrede,
                                namenspraefix: src.namePraefix,
                                namenssuffix: src.nameSuffix,
                                sortierindex: src.nameSortierindex,
                            }),
                    ),
                ),
                forMember(
                    (dest: PersonDto) => dest.geburt,
                    mapFrom(
                        (src: PersonDo<boolean>) =>
                            new PersonGeburtDto({ datum: src.geburtsdatum, geburtsort: src.geburtsort }),
                    ),
                ),
                forMember(
                    (dest: PersonDto) => dest.geschlecht,
                    mapFrom((src: PersonDo<boolean>) => src.geschlecht),
                ),
                forMember(
                    (dest: PersonDto) => dest.stammorganisation,
                    mapFrom((src: PersonDo<boolean>) => src.stammorganisation),
                ),
                forMember(
                    (dest: PersonDto) => dest.lokalisierung,
                    mapFrom((src: PersonDo<boolean>) => src.lokalisierung),
                ),
                forMember(
                    (dest: PersonDto) => dest.vertrauensstufe,
                    mapFrom((src: PersonDo<boolean>) => src.vertrauensstufe),
                ),
            );

            createMap(mapper, LoeschungDto, LoeschungResponse);

            createMap(mapper, PersonenkontextDto, PersonenkontextResponse);

            createMap(mapper, PersonDto, PersonResponse);

            createMap(mapper, PersonNameDto, PersonNameParams);

            createMap(mapper, PersonGeburtDto, PersonBirthParams);

            createMap(mapper, PersonendatensatzDto, PersonendatensatzResponse);
        };
    }
}
