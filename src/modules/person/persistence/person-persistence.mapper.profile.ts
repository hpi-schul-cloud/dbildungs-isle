import { Mapper, MappingProfile, createMap, forMember, mapFrom } from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { PersonDo } from '../domain/person.do.js';
import { PersonEntity } from '../persistence/person.entity.js';

@Injectable()
export class PersonPersistenceMapperProfile extends AutomapperProfile {
    public constructor(@Inject(getMapperToken()) mapper: Mapper) {
        super(mapper);
    }

    public override get profile(): MappingProfile {
        return (mapper: Mapper) => {
            createMap(mapper, PersonDo, PersonEntity);
            createMap(
                mapper,
                PersonEntity,
                PersonDo,
                forMember(
                    (dest: PersonDo<boolean>) => dest.id,
                    mapFrom((src: PersonEntity) => src.id),
                ),
                forMember(
                    (dest: PersonDo<boolean>) => dest.createdAt,
                    mapFrom((src: PersonEntity) => src.createdAt),
                ),
                forMember(
                    (dest: PersonDo<boolean>) => dest.updatedAt,
                    mapFrom((src: PersonEntity) => src.updatedAt),
                ),
                forMember(
                    (dest: PersonDo<boolean>) => dest.nameSalutation,
                    mapFrom((src: PersonEntity) => src.nameSalutation),
                ),
                forMember(
                    (dest: PersonDo<boolean>) => dest.namePrefix,
                    mapFrom((src: PersonEntity) => src.namePrefix),
                ),
                forMember(
                    (dest: PersonDo<boolean>) => dest.nameSuffix,
                    mapFrom((src: PersonEntity) => src.nameSuffix),
                ),
            );
        };
    }
}
