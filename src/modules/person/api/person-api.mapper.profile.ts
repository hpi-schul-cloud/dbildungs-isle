import { Converter, Mapper, MappingProfile, convertUsing, createMap, forMember, mapFrom } from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { CreatePersonDto } from '../domain/create-person.dto.js';
import { PersonDo } from '../domain/person.do.js';
import { Gender, TrustLevel } from '../domain/person.enums.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { PersonGender, PersonTrustLevel } from './person.enums.js';
import { PersonResponse } from './person.response.js';

export const personGenderToGenderConverter: Converter<PersonGender, Gender> = {
    convert(source: PersonGender): Gender {
        switch (source) {
            case PersonGender.DIVERSE:
                return Gender.DIVERSE;
            case PersonGender.FEMALE:
                return Gender.FEMALE;
            case PersonGender.MALE:
                return Gender.MALE;
            default:
                return Gender.UNKNOWN;
        }
    },
};

export const personTrustLevelToTrustLevelConverter: Converter<PersonTrustLevel, TrustLevel> = {
    convert(source: PersonTrustLevel): TrustLevel {
        switch (source) {
            case PersonTrustLevel.NONE:
                return TrustLevel.NONE;
            case PersonTrustLevel.TRUSTED:
                return TrustLevel.TRUSTED;
            case PersonTrustLevel.VERIFIED:
                return TrustLevel.VERIFIED;
            default:
                return TrustLevel.UNKNOWN;
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
                    (dest: CreatePersonDto) => dest.lastName,
                    mapFrom((src: CreatePersonBodyParams) => src.name.lastName),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.firstName,
                    mapFrom((src: CreatePersonBodyParams) => src.name.firstName),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.initialsLastName,
                    mapFrom((src: CreatePersonBodyParams) => src.name.initialsLastName),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.initialsFirstName,
                    mapFrom((src: CreatePersonBodyParams) => src.name.initialsFirstName),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.nickName,
                    mapFrom((src: CreatePersonBodyParams) => src.name.nickName),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.gender,
                    convertUsing(personGenderToGenderConverter, (src: CreatePersonBodyParams) => src.gender),
                ),
                forMember(
                    (dest: CreatePersonDto) => dest.trustLevel,
                    convertUsing(
                        personTrustLevelToTrustLevelConverter,
                        (src: CreatePersonBodyParams) => src.trustLevel,
                    ),
                ),
            );
            createMap(mapper, CreatePersonDto, PersonDo);
            createMap(
                mapper,
                PersonDo,
                PersonResponse,
                forMember(
                    (dest: PersonResponse) => dest.id,
                    mapFrom((src: PersonDo<true>) => src.id),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.firstName,
                    mapFrom((src: PersonDo<true>) => src.firstName),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.lastName,
                    mapFrom((src: PersonDo<true>) => src.lastName),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.initialsFirstName,
                    mapFrom((src: PersonDo<true>) => src.initialsFirstName),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.initialsLastName,
                    mapFrom((src: PersonDo<true>) => src.initialsLastName),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.sortIndex,
                    mapFrom((src: PersonDo<true>) => src.nameSortIndex),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.nickName,
                    mapFrom((src: PersonDo<true>) => src.nickName),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.title,
                    mapFrom((src: PersonDo<true>) => src.nameTitle),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.salutation,
                    mapFrom((src: PersonDo<true>) => src.nameSalutation),
                ),
                forMember(
                    (dest: PersonResponse) => dest.name.suffix,
                    mapFrom((src: PersonDo<true>) => src.nameSuffix),
                ),
            );
        };
    }
}
