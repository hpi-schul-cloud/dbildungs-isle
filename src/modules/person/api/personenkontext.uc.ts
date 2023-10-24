import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/error/domain.error.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonService } from '../domain/person.service.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { PersonenkontextService } from '../domain/personenkontext.service.js';
import { CreatePersonenkontextDto } from './create-personenkontext.dto.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { PersonDto } from './person.dto.js';
import { PersonendatensatzDto } from './personendatensatz.dto.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { PersonenkontextResponse } from './personenkontext.response.js';

@Injectable()
export class PersonenkontextUc {
    public constructor(
        private readonly personService: PersonService,
        private readonly personenkontextService: PersonenkontextService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    public async createPersonenkontext(
        personenkontextDto: CreatePersonenkontextDto,
    ): Promise<CreatedPersonenkontextDto> {
        const personenkontextDo: PersonenkontextDo<false> = this.mapper.map(
            personenkontextDto,
            CreatePersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<PersonenkontextDo<true>> = await this.personenkontextService.createPersonenkontext(
            personenkontextDo,
        );
        if (result.ok) {
            return this.mapper.map(result.value, PersonenkontextDo, CreatedPersonenkontextDto);
        }
        throw result.error;
    }

    // TODO refactor after EW-561 is done
    public async findAll(findePersonenkontextDto: FindPersonenkontextDto): Promise<PersonenkontextResponse[]> {
        const personenkontextDo: PersonenkontextDo<false> = this.mapper.map(
            findePersonenkontextDto,
            FindPersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<PersonenkontextDo<true>[], DomainError> =
            await this.personenkontextService.findAllPersonenkontexte(personenkontextDo);

        if (!result.ok) {
            throw result.error;
        }

        const personenkontexte: PersonenkontextResponse[] = result.value.map(
            (personenkontext: PersonenkontextDo<true>) =>
                this.mapper.map(personenkontext, PersonenkontextDo, PersonenkontextResponse),
        );
        return personenkontexte;
    }

    public async findById(dto: FindPersonenkontextByIdDto): Promise<PersonendatensatzDto> {
        const personenkontextResult: Result<PersonenkontextDo<true>> = await this.personenkontextService.findById(
            dto.personenkontextId,
        );

        if (!personenkontextResult.ok) {
            throw personenkontextResult.error;
        }

        const personResult: Result<PersonDo<true>> = await this.personService.findPersonById(
            personenkontextResult.value.personId,
        );

        if (!personResult.ok) {
            throw personResult.error;
        }

        return new PersonendatensatzDto({
            person: this.mapper.map(personResult.value, PersonDo, PersonDto),
            personenkontexte: [this.mapper.map(personenkontextResult.value, PersonenkontextDo, PersonenkontextDto)],
        });
    }
}
