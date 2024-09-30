import { Injectable } from '@nestjs/common';
import { DomainError, EntityNotFoundError } from '../../../shared/error/index.js';
import { PersonScope } from '../persistence/person.scope.js';
import { Paged } from '../../../shared/paging/paged.js';
import { ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { Person } from './person.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { PersonRepository } from '../persistence/person.repository.js';

export type PersonPersonenkontext = {
    person: Person<true>;
    personenkontext: Personenkontext<true>;
};

@Injectable()
export class PersonService {
    public constructor(private readonly personRepository: PersonRepository) {}

    public async findPersonById(id: string): Promise<Result<Person<true>, DomainError>> {
        const person: Option<Person<true>> = await this.personRepository.findById(id);
        if (person) {
            return { ok: true, value: person };
        }
        return { ok: false, error: new EntityNotFoundError('Person', id) };
    }

    public async findAllPersons(
        person: Partial<Person<false>>,
        offset?: number,
        limit?: number,
    ): Promise<Paged<Person<true>>> {
        const scope: PersonScope = new PersonScope()
            .findBy({
                vorname: person.vorname,
                familienname: person.familienname,
                geburtsdatum: person.geburtsdatum,
            })
            .sortBy('vorname', ScopeOrder.ASC)
            .paged(offset, limit);
        const [persons, total]: Counted<Person<true>> = await this.personRepository.findBy(scope);

        return {
            total,
            offset: offset ?? 0,
            limit: limit ?? total,
            items: persons,
        };
    }
}
