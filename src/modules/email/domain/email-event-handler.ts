import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { ServiceProviderKategorie } from '../../service-provider/domain/service-provider.enum.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { DomainError } from '../../../shared/error/index.js';
import { PersonID } from '../../../shared/types/index.js';
import { EmailAddressEntity } from '../persistence/email-address.entity.js';
import { EmailAddressNotFoundError } from '../error/email-address-not-found.error.js';
import { EmailRepo } from '../persistence/email.repo.js';
import { EmailFactory } from './email.factory.js';
import { EmailAddress } from './email-address.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { RolleUpdatedEvent } from '../../../shared/events/rolle-updated.event.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { OxUserAttributesCreatedEvent } from '../../../shared/events/ox-user-attributes-created.event.js';

@Injectable()
export class EmailEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly emailFactory: EmailFactory,
        private readonly emailRepo: EmailRepo,
        private readonly rolleRepo: RolleRepo,
        private readonly serviceProviderRepo: ServiceProviderRepo,
        private readonly dbiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly eventService: EventService,
    ) {}

    @EventHandler(PersonRenamedEvent)
    // eslint-disable-next-line @typescript-eslint/require-await
    public async handlePersonRenamedEvent(event: PersonRenamedEvent): Promise<void> {
        this.logger.info(`Received PersonRenamedEvent, personId:${event.personId}`);

        const rollen: Rolle<true>[] = await this.getRollenForPerson(event.personId);
        if (await this.anyRolleReferencesEmailServiceProvider(rollen)) {
            const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findByPerson(event.personId);
            if (existingEmail) {
                this.logger.info(
                    `Existing email found for personId:${event.personId}, address:${existingEmail.currentAddress}`,
                );
                if (existingEmail.enabledOrRequested) {
                    existingEmail.disable();
                    const persistenceResult: EmailAddress<true> | DomainError =
                        await this.emailRepo.save(existingEmail);
                    if (persistenceResult instanceof EmailAddress) {
                        this.logger.info(`Disabled and saved address:${persistenceResult.currentAddress}`);
                    } else {
                        this.logger.error(`Could not disable email, error is ${persistenceResult.message}`);
                    }
                }
            }
            this.logger.info(`Creating new email-address for personId:${event.personId}, due to PersonRenamedEvent`);
            await this.createNewEmail(event.personId);
        }
    }

    private async getRollenForPerson(personId: PersonID): Promise<Rolle<true>[]> {
        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        const rollenIds: string[] = [];
        for (const personenkontext of personenkontexte) {
            rollenIds.push(personenkontext.rolleId);
        }
        const rollenMap: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIds);

        return Array.from(rollenMap.values(), (value: Rolle<true>) => {
            return value;
        });
    }

    @EventHandler(PersonenkontextUpdatedEvent)
    // currently receiving of this event is not causing a deletion of email and the related addresses for the affected user, this is intentional
    public async handlePersonenkontextUpdatedEvent(event: PersonenkontextUpdatedEvent): Promise<void> {
        this.logger.info(`Received handlePersonenkontextUpdatedEvent, personId:${event.person.id}`);

        await this.handlePerson(event.person.id);
    }

    // this method cannot make use of handlePerson(personId) method, because personId is already null when event is received
    @EventHandler(PersonDeletedEvent)
    public async handlePersonDeletedEvent(event: PersonDeletedEvent): Promise<void> {
        this.logger.info(`Received PersonDeletedEvent, personId:${event.personId}`);
        //Setting person_id to null in Email table is done via deleteRule, not necessary here

        if (!event.emailAddress) {
            this.logger.info('Cannot deactivate email-address, person did not have an email-address');
            return;
        }
        const deactivationResult: EmailAddressEntity | EmailAddressNotFoundError =
            await this.emailRepo.deactivateEmailAddress(event.emailAddress);
        if (deactivationResult instanceof EmailAddressNotFoundError) {
            this.logger.error(`Deactivation of email-address:${event.emailAddress} failed`);
            return;
        }
        this.logger.info(`Successfully deactivated email-address:${event.emailAddress}`);
    }

    private async anyRolleReferencesEmailServiceProvider(rollen: Rolle<true>[]): Promise<boolean> {
        const pro: Promise<boolean>[] = rollen.map((rolle: Rolle<true>) =>
            this.rolleReferencesEmailServiceProvider(rolle),
        );
        const results: boolean[] = await Promise.all(pro);

        return results.some((r: boolean) => r);
    }

    @EventHandler(RolleUpdatedEvent)
    // eslint-disable-next-line @typescript-eslint/require-await
    public async handleRolleUpdatedEvent(event: RolleUpdatedEvent): Promise<void> {
        this.logger.info(`Received RolleUpdatedEvent, rolleId:${event.rolleId}`);

        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByRolle(
            event.rolleId,
        );
        const personIdsSet: Set<PersonID> = new Set<PersonID>();
        personenkontexte.map((pk: Personenkontext<true>) => personIdsSet.add(pk.personId));
        const distinctPersonIds: PersonID[] = Array.from(personIdsSet.values());

        this.logger.info(`RolleUpdatedEvent affects:${distinctPersonIds.length} persons`);

        const handlePersonPromises: Promise<void>[] = distinctPersonIds.map((personId: PersonID) => {
            return this.handlePerson(personId);
        });

        await Promise.all(handlePersonPromises);
    }

    @EventHandler(OxUserAttributesCreatedEvent)
    public async handleOxUserAttributesCreatedEvent(event: OxUserAttributesCreatedEvent): Promise<void> {
        this.logger.info(
            `Received OxUserAttributesCreatedEvent personId:${event.personId}, keycloakUsername: ${event.keycloakUsername}, userName:${event.userName}, contextName:${event.contextName}, email:${event.emailAddress}`,
        );
        const email: Option<EmailAddress<true>> = await this.emailRepo.findByPerson(event.personId);

        if (!email) {
            return this.logger.error(
                `Cannot find email-address for person with personId:${event.personId}, enabling not possible`,
            );
        }

        if (email.address !== event.emailAddress) {
            this.logger.warning(
                `Mismatch between requested(${email.address}) and received(${event.emailAddress}) address from OX`,
            );
            this.logger.warning(`Overriding ${email.address} with ${event.emailAddress}) from OX`);
            email.setAddress(event.emailAddress);
        }

        email.enable();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email);

        if (persistenceResult instanceof DomainError) {
            return this.logger.error(`Could not enable email, error is ${persistenceResult.message}`);
        } else {
            return this.logger.info(`Changed email-address:${persistenceResult.address} from REQUESTED to ENABLED`);
        }
    }

    private async handlePerson(personId: PersonID): Promise<void> {
        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        const rollenIds: string[] = personenkontexte.map((pk: Personenkontext<true>) => pk.rolleId);
        const rollenMap: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIds);
        const rollen: Rolle<true>[] = Array.from(rollenMap.values(), (value: Rolle<true>) => {
            return value;
        });

        const needsEmail: boolean = await this.anyRolleReferencesEmailServiceProvider(rollen);

        if (needsEmail) {
            this.logger.info(`Person with id:${personId} needs an email, creating or enabling address`);
            await this.createOrEnableEmail(personId);
        } else {
            //currently no else for calling disablingEmail is necessary, emails are only disabled, when the person is deleted not by PK-events
            this.logger.info(`Person with id:${personId} does not need an email`);
        }
    }

    private async createOrEnableEmail(personId: PersonID): Promise<void> {
        const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findByPerson(personId);

        if (existingEmail) {
            this.logger.info(`Existing email found for personId:${personId}`);

            if (existingEmail.enabled) {
                return this.logger.info(`Existing email for personId:${personId} already enabled`);
            } else {
                existingEmail.request();
                const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(existingEmail);
                if (persistenceResult instanceof EmailAddress) {
                    this.logger.info(`Set Requested status and persisted address:${persistenceResult.address}`);
                    this.eventService.publish(
                        new EmailAddressGeneratedEvent(
                            personId,
                            persistenceResult.id,
                            persistenceResult.address,
                            persistenceResult.enabled,
                        ),
                    );
                } else {
                    return this.logger.error(`Could not enable email, error is ${persistenceResult.message}`);
                }
            }
        } else {
            this.logger.info(`No existing email found for personId:${personId}, creating a new one`);
            await this.createNewEmail(personId);
        }
    }

    private async createNewEmail(personId: PersonID): Promise<void> {
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNew(personId);
        if (!email.ok) {
            this.logger.error(`Could not create email, error is ${email.error.message}`);
            return;
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted email with Request status for address:${persistenceResult.address}`,
            );
            this.eventService.publish(
                new EmailAddressGeneratedEvent(
                    personId,
                    persistenceResult.id,
                    persistenceResult.address,
                    persistenceResult.enabled,
                ),
            );
        } else {
            this.logger.error(`Could not persist email, error is ${persistenceResult.message}`);
        }
    }

    private async rolleReferencesEmailServiceProvider(rolle: Rolle<true>): Promise<boolean> {
        const serviceProviderMap: Map<string, ServiceProvider<true>> = await this.serviceProviderRepo.findByIds(
            rolle.serviceProviderIds,
        );
        const serviceProviders: ServiceProvider<true>[] = Array.from(
            serviceProviderMap.values(),
            (value: ServiceProvider<true>) => {
                return value;
            },
        );

        return serviceProviders.some((sp: ServiceProvider<true>) => sp.kategorie === ServiceProviderKategorie.EMAIL);
    }
}
