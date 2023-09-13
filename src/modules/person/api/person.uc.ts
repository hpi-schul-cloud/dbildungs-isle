import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { CreatePersonDto } from '../domain/create-person.dto.js';
import { PersonService } from '../domain/person.service.js';
import { PersonDo } from '../domain/person.do.js';
import { FindPersonDatensatzDTO } from './finde-persondatensatz-dto.js';
import { PersonenDatensatz } from './personendatensatz.js';

@Injectable()
export class PersonUc {
    public constructor(
        private readonly personService: PersonService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    public async createPerson(personDto: CreatePersonDto): Promise<void> {
        const personDo: PersonDo<false> = this.mapper.map(personDto, CreatePersonDto, PersonDo);
        const result: Result<PersonDo<true>> = await this.personService.createPerson(personDo);
        if (result.ok) {
            return;
        }
        throw result.error;
    }

    public async findPersonById(id: string): Promise<PersonenDatensatz> {
        const result: Result<PersonDo<true>> = await this.personService.findPersonById(id);
        if (result.ok) {
            const person: PersonenDatensatz = this.mapper.map(result.value, PersonDo, PersonenDatensatz);
            return person;
        }
        throw result.error;
    }

    public async findAll(personDto: FindPersonDatensatzDTO): Promise<PersonenDatensatz[]> {
        const personDo: PersonDo<false> = this.mapper.map(personDto, FindPersonDatensatzDTO, PersonDo);
        const result: PersonDo<true>[] = await this.personService.findAllPersons(personDo);
        if (result.length !== 0) {
            const persons: PersonenDatensatz[] = result.map((person: PersonDo<true>) =>
                this.mapper.map(person, PersonDo, PersonenDatensatz),
            );
            return persons;
        }
        return [];
    }
}
