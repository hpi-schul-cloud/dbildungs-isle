import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { Paged } from '../../../shared/paging/paged.js';
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
import { UpdatePersonenkontextDto } from './update-personenkontext.dto.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { DeletePersonenkontextDto } from './delete-personkontext.dto.js';
@Injectable()
export class PersonenkontextUc {
    public constructor(
        private readonly personService: PersonService,
        private readonly personenkontextService: PersonenkontextService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    public async createPersonenkontext(
        personenkontextDto: CreatePersonenkontextDto,
    ): Promise<CreatedPersonenkontextDto | SchulConnexError> {
        const personenkontextDo: PersonenkontextDo<false> = this.mapper.map(
            personenkontextDto,
            CreatePersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<
            PersonenkontextDo<true>,
            DomainError
        > = await this.personenkontextService.createPersonenkontext(personenkontextDo);

        if (result.ok) {
            return this.mapper.map(result.value, PersonenkontextDo, CreatedPersonenkontextDto);
        }
        return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
    }

    public async findAll(findPersonenkontextDto: FindPersonenkontextDto): Promise<Paged<PersonenkontextDto>> {
        const personenkontextDo: PersonenkontextDo<false> = this.mapper.map(
            findPersonenkontextDto,
            FindPersonenkontextDto,
            PersonenkontextDo,
        );

        const result: Paged<PersonenkontextDo<true>> = await this.personenkontextService.findAllPersonenkontexte(
            personenkontextDo,
            findPersonenkontextDto.offset,
            findPersonenkontextDto.limit,
        );

        const personenkontexte: PersonenkontextDto[] = this.mapper.mapArray(
            result.items,
            PersonenkontextDo,
            PersonenkontextDto,
        );

        return {
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            items: personenkontexte,
        };
    }

    public async findPersonenkontextById(
        dto: FindPersonenkontextByIdDto,
    ): Promise<PersonendatensatzDto | SchulConnexError> {
        const personenkontextResult: Result<
            PersonenkontextDo<true>,
            DomainError
        > = await this.personenkontextService.findPersonenkontextById(dto.personenkontextId);

        if (!personenkontextResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personenkontextResult.error);
        }

        const personResult: Result<PersonDo<true>, DomainError> = await this.personService.findPersonById(
            personenkontextResult.value.personId,
        );

        if (!personResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personResult.error);
        }

        return new PersonendatensatzDto({
            person: this.mapper.map(personResult.value, PersonDo, PersonDto),
            personenkontexte: [this.mapper.map(personenkontextResult.value, PersonenkontextDo, PersonenkontextDto)],
        });
    }

    public async updatePersonenkontext(
        updateDto: UpdatePersonenkontextDto,
    ): Promise<PersonendatensatzDto | SchulConnexError> {
        const personenkontextDo: PersonenkontextDo<true> = this.mapper.map(
            updateDto,
            UpdatePersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<
            PersonenkontextDo<true>,
            DomainError
        > = await this.personenkontextService.updatePersonenkontext(personenkontextDo);

        if (!result.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
        }

        const personResult: Result<PersonDo<true>, DomainError> = await this.personService.findPersonById(
            result.value.personId,
        );

        if (!personResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personResult.error);
        }

        return new PersonendatensatzDto({
            person: this.mapper.map(personResult.value, PersonDo, PersonDto),
            personenkontexte: [this.mapper.map(result.value, PersonenkontextDo, PersonenkontextDto)],
        });
    }

    public async deletePersonenkontextById(
        deletePersonenkontextDto: DeletePersonenkontextDto,
    ): Promise<void | SchulConnexError> {
        const result: Result<void, DomainError> = await this.personenkontextService.deletePersonenkontextById(
            deletePersonenkontextDto.id,
            deletePersonenkontextDto.revision,
        );

        if (!result.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
        }
    }
}
