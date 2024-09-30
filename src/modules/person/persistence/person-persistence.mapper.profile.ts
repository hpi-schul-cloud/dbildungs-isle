import { Mapper, MappingProfile, beforeMap, createMap, forMember, ignore, mapFrom } from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { PersonEntity } from '../persistence/person.entity.js';
import { PersonenkontextDo } from '../../personenkontext/domain/personenkontext.do.js';
import { ref } from '@mikro-orm/core';
import { PersonenkontextEntity } from '../../personenkontext/persistence/personenkontext.entity.js';
import { RolleEntity } from '../../rolle/entity/rolle.entity.js';

@Injectable()
export class PersonPersistenceMapperProfile extends AutomapperProfile {
    public constructor(@Inject(getMapperToken()) mapper: Mapper) {
        super(mapper);
    }

    public override get profile(): MappingProfile {
        return (mapper: Mapper) => {
            createMap(
                mapper,
                PersonenkontextDo,
                PersonenkontextEntity,
                // Automapper tries to assign an empty property to the destination before merging in the real data
                // Because MikroORM hooks properties, we need to create the property ourself so it doesn't crash
                beforeMap((_source: PersonenkontextDo<boolean>, dest: PersonenkontextEntity) => {
                    dest.personId = ref(PersonEntity, '');
                    dest.rolleId = ref(RolleEntity, '');
                }),
                forMember(
                    (dest: PersonenkontextEntity) => dest.personId,
                    mapFrom((from: PersonenkontextDo<boolean>) => ref(PersonEntity, from.personId)),
                ),
                forMember(
                    (dest: PersonenkontextEntity) => dest.rolleId,
                    mapFrom((from: PersonenkontextDo<boolean>) => ref(RolleEntity, from.rolleId)),
                ),
            );
            createMap(
                mapper,
                PersonenkontextEntity,
                PersonenkontextDo,
                forMember((dest: PersonenkontextDo<boolean>) => dest.organisationId, ignore()),
                forMember(
                    (dest: PersonenkontextDo<boolean>) => dest.personId,
                    mapFrom((from: PersonenkontextEntity) => from.personId?.id),
                ),
                forMember(
                    (dest: PersonenkontextDo<boolean>) => dest.rolleId,
                    mapFrom((from: PersonenkontextEntity) => from.rolleId?.id),
                ),
            );
        };
    }
}
