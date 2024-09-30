import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError, EntityCouldNotBeDeleted } from '../../../shared/error/index.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';

@Injectable()
export class PersonDeleteService {
    public constructor(
        private readonly logger: ClassLogger,
        private personRepository: PersonRepository,
        private personenkontextRepo: DBiamPersonenkontextRepo,
    ) {}

    public async deletePerson(
        personId: string,
        personPermissions: PersonPermissions,
    ): Promise<Result<void, DomainError>> {
        this.logger.info(`Deleting person with id ${personId}`);
        const removedPersonenkontextsResult: Result<PersonenkontextEventKontextData[], EntityCouldNotBeDeleted> =
            await this.getPersonkontextData(personId);
        if (!removedPersonenkontextsResult.ok) {
            return removedPersonenkontextsResult;
        }

        return this.personRepository.deletePerson(personId, personPermissions, removedPersonenkontextsResult.value);
    }

    private async getPersonkontextData(
        personId: PersonID,
    ): Promise<Result<PersonenkontextEventKontextData[], EntityCouldNotBeDeleted>> {
        try {
            const personenKontexts: Personenkontext<true>[] = await this.personenkontextRepo.findByPerson(personId);

            const removedPersonenkontexts: PersonenkontextEventKontextData[] = await Promise.all(
                personenKontexts.map((personenKontext: Personenkontext<true>) => {
                    return new Promise<PersonenkontextEventKontextData>(
                        (resolve: (value: PersonenkontextEventKontextData) => void, reject: () => void) => {
                            personenKontext.getRolle().then(
                                (rolle: Option<Rolle<true>>) =>
                                    rolle
                                        ? resolve({
                                              id: personenKontext.id,
                                              rolleId: personenKontext.rolleId,
                                              orgaId: personenKontext.organisationId,
                                              rolle: rolle.rollenart,
                                              serviceProviderExternalSystems: rolle.serviceProviderData.map(
                                                  (sp: ServiceProvider<true>) => sp.externalSystem,
                                              ),
                                          })
                                        : reject(),
                                () => reject(),
                            );
                        },
                    );
                }),
            );
            return { ok: true, value: removedPersonenkontexts };
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error while loading Kontexts of person to delete: ${error.message}`);
            } else {
                this.logger.error(`Error while loading Kontexts of person to delete: ${JSON.stringify(error)}`);
            }
            return { ok: false, error: new EntityCouldNotBeDeleted('Person', personId) };
        }
    }
}
