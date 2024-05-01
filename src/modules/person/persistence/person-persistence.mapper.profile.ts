import { Mapper, MappingProfile, beforeMap, createMap, forMember, ignore, mapFrom } from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { ref } from '@mikro-orm/core';
import { PersonDo } from '../domain/person.do.js';
import { PersonenkontextDo } from '../../personenkontext/domain/personenkontext.do.js';
import { PersonEntity } from '../persistence/person.entity.js';
import { PersonenkontextEntity } from '../../personenkontext/persistence/personenkontext.entity.js';

@Injectable()
export class PersonPersistenceMapperProfile extends AutomapperProfile {
    public constructor(@Inject(getMapperToken()) mapper: Mapper) {
        super(mapper);
    }

    public override get profile(): MappingProfile {
        return (mapper: Mapper) => {
            createMap(mapper, PersonDo, PersonEntity);
            createMap(mapper, PersonEntity, PersonDo);

            createMap(
                mapper,
                PersonenkontextDo,
                PersonenkontextEntity,
                // Automapper tries to assign an empty property to the destination before merging in the real data
                // Because MikroORM hooks properties, we need to create the property ourself so it doesn't crash
                beforeMap((_source: PersonenkontextDo<boolean>, dest: PersonenkontextEntity) => {
                    dest.personId = ref(PersonEntity, '');
                }),
                forMember(
                    (dest: PersonenkontextEntity) => dest.personId,
                    mapFrom((from: PersonenkontextDo<boolean>) => ref(PersonEntity, from.personId)),
                ),
            );
            createMap(
                mapper,
                PersonenkontextEntity,
                PersonenkontextDo,
                forMember((dest: PersonenkontextDo<boolean>) => dest.organisation, ignore()),
                forMember(
                    (dest: PersonenkontextDo<boolean>) => dest.personId,
                    mapFrom((from: PersonenkontextEntity) => from.personId?.id),
                ),
            );
        };
    }
}
