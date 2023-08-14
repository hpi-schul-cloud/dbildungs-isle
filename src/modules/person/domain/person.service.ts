import { Inject, Injectable } from '@nestjs/common';
import { DomainError, PersonAlreadyExistsError } from '../../../shared/error/index.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonRepo } from '../persistence/person.repo.js';
import { MODULE_LOGGER } from '../../../core/logging/module-logger-factory.js';
import { ModuleLogger } from '../../../core/logging/logger.js';

@Injectable()
export class PersonService {
    public constructor(private readonly personRepo: PersonRepo, @Inject(MODULE_LOGGER) private logger: ModuleLogger) {
        logger.context = PersonService.name;
    }

    public async createPerson(personDo: PersonDo<false>): Promise<Result<PersonDo<true>, DomainError>> {
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
