import { Mapper, MappingProfile, createMap, forMember, ignore } from '@automapper/core';
import { AutomapperProfile, getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
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

            createMap(mapper, PersonenkontextDo, PersonenkontextEntity);
            createMap(
                mapper,
                PersonenkontextEntity,
                PersonenkontextDo,
                forMember((dest: PersonenkontextDo<boolean>) => dest.organisation, ignore()),
            );
        };
    }
}
