import { Injectable } from '@nestjs/common';
import { DomainError, PersonAlreadyExistsError } from '../../../shared/error/index.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonRepo } from '../persistence/person.repo.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';

@Injectable()
export class PersonService {
    public constructor(private readonly personRepo: PersonRepo, private logger: ClassLogger) {}

    public async createPerson(personDo: PersonDo<false>): Promise<Result<PersonDo<true>, DomainError>> {
        this.logger.warning('createPersonWarning');
        this.logger.notice('createPersonNotice');
        this.logger.debug('createPersonDebug');
        if (personDo.referrer && (await this.personRepo.findByReferrer(personDo.referrer))) {
            return {
                ok: false,
                error: new PersonAlreadyExistsError(`Person with referrer ${personDo.referrer} already exists`),
            };
        }
        const newPerson: PersonDo<true> = await this.personRepo.save(personDo);
        return { ok: true, value: newPerson };
    }
}
