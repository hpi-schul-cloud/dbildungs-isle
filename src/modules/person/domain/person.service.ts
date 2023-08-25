import { Injectable } from '@nestjs/common';
import { DomainError, EntityNotFoundError, PersonAlreadyExistsError } from '../../../shared/error/index.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonRepo } from '../persistence/person.repo.js';
import { Specification, UserFirstNameSpecification, UserVisibilitySpecification } from '../specifications/spect.js';
import { PersonEntity } from '../persistence/person.entity.js';

@Injectable()
export class PersonService {
    public constructor(private readonly personRepo: PersonRepo) {}

    public async createPerson(personDo: PersonDo<false>): Promise<Result<PersonDo<true>, DomainError>> {
        if (personDo.referrer && (await this.personRepo.findByReferrer(personDo.referrer))) {
            return {
                ok: false,
                error: new PersonAlreadyExistsError(`Person with referrer ${personDo.referrer} already exists`),
            };
        }
        const newPerson: PersonDo<true> = await this.personRepo.save(personDo);
        return { ok: true, value: newPerson };
    }

    public async findPersonById(id: string): Promise<Result<PersonDo<true>, DomainError>> {
        const person: Option<PersonDo<true>> = await this.personRepo.findById(id);
        if (person) {
            return { ok: true, value: person };
        }
        return { ok: false, error: new EntityNotFoundError(`Person with the following ID ${id} does not exist`) };
    }

    public async findPersonBy(): Promise<void> {
        const spec: Specification<PersonEntity> = new UserVisibilitySpecification(true).and(
            new UserFirstNameSpecification('John'),
        );
        const persons: PersonEntity[] = await this.personRepo.findBy(spec);
        // eslint-disable-next-line no-console
        console.log(persons);
    }
}
