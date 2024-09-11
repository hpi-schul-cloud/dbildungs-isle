import { Injectable } from '@nestjs/common';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
import { EmailGenerator } from './email-generator.js';
import { EmailRepo } from '../persistence/email.repo.js';
import { Person } from '../../person/domain/person.js';
import { EntityNotFoundError } from '../../../shared/error/index.js';

@Injectable()
export class EmailFactory {
    private emailGenerator: EmailGenerator;

    public constructor(
        private readonly emailRepo: EmailRepo,
        private readonly personRepository: PersonRepository,
    ) {
        this.emailGenerator = new EmailGenerator(this.emailRepo);
    }

    public construct(
        id: string,
        createdAt: Date,
        updatedAt: Date,
        personId: PersonID,
        address: string,
        enabled: EmailAddressStatus,
    ): EmailAddress<true> {
        return EmailAddress.construct(id, createdAt, updatedAt, personId, address, enabled);
    }

    public async createNew(personId: PersonID): Promise<Result<EmailAddress<false>>> {
        const person: Option<Person<true>> = await this.personRepository.findById(personId);
        if (!person) {
            return {
                ok: false,
                error: new EntityNotFoundError('Person', personId),
            };
        }
        const generatedAddressResult: Result<string> = await this.emailGenerator.generateAvailableAddress(
            person.vorname,
            person.familienname,
        );
        if (!generatedAddressResult.ok) {
            return {
                ok: false,
                error: generatedAddressResult.error,
            };
        }

        const newEmailAddress: EmailAddress<false> = EmailAddress.createNew(
            personId,
            generatedAddressResult.value,
            EmailAddressStatus.REQUESTED,
        );

        return {
            ok: true,
            value: newEmailAddress,
        };
    }
}
