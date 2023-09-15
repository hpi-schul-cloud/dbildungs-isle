import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { CreatePersonDto } from '../domain/create-person.dto.js';
import { PersonService } from '../domain/person.service.js';
import { PersonDo } from '../domain/person.do.js';
import { FindPersonDatensatzDTO } from './finde-persondatensatz-dto.js';
import { PersonenDatensatz } from './personendatensatz.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { SchulConnexError } from '../../../shared/error/schul-connex-error.js';
import { DomainError } from '../../../shared/error';

@Injectable()
export class PersonUc {
    public constructor(
        private readonly personService: PersonService,
        @Inject(getMapperToken()) private readonly autoMapper: Mapper,
    ) {}

    public async createPerson(personDto: CreatePersonDto): Promise<void> {
        const personDo: PersonDo<false> = this.autoMapper.map(personDto, CreatePersonDto, PersonDo);
        const result: Result<PersonDo<true>> = await this.personService.createPerson(personDo);
        if (result.ok) {
            return;
        }
        throw result.error;
    }

    public async findPersonById(id: string): Promise<PersonenDatensatz | SchulConnexError> {
        const result: Result<PersonDo<true>, DomainError> = await this.personService.findPersonById(id);
        if (result.ok) {
            const person: PersonenDatensatz = this.autoMapper.map(result.value, PersonDo, PersonenDatensatz);
            return person;
        }
        const error: SchulConnexError = SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
        return error;
    }

    public async findAll(personDto: FindPersonDatensatzDTO): Promise<PersonenDatensatz[]> {
        const personDo: PersonDo<false> = this.autoMapper.map(personDto, FindPersonDatensatzDTO, PersonDo);
        const result: PersonDo<true>[] = await this.personService.findAllPersons(personDo);
        if (result.length !== 0) {
            const persons: PersonenDatensatz[] = result.map((person: PersonDo<true>) =>
                this.autoMapper.map(person, PersonDo, PersonenDatensatz),
            );
            return persons;
        }
        return [];
    }
}
