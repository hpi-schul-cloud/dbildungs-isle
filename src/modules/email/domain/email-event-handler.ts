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
import { OrganisationID, PersonID } from '../../../shared/types/index.js';
import { EmailAddressEntity } from '../persistence/email-address.entity.js';
import { EmailAddressNotFoundError } from '../error/email-address-not-found.error.js';
import { EmailRepo } from '../persistence/email.repo.js';
import { EmailFactory } from './email.factory.js';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { RolleUpdatedEvent } from '../../../shared/events/rolle-updated.event.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { OxMetadataInKeycloakChangedEvent } from '../../../shared/events/ox-metadata-in-keycloak-changed.event.js';
import { EmailAddressChangedEvent } from '../../../shared/events/email-address-changed.event.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { PersonenkontextMigrationRuntype } from '../../personenkontext/domain/personenkontext.enums.js';

type RolleWithPK = {
    rolle: Rolle<true>;
    personenkontext: Personenkontext<true>;
};

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
    public async handlePersonRenamedEvent(event: PersonRenamedEvent): Promise<void> {
        this.logger.info(`Received PersonRenamedEvent, personId:${event.personId}`);

        const rollenWithPK: Map<string, RolleWithPK> = await this.getRollenWithPKForPerson(event.personId);
        const rollen: Rolle<true>[] = Array.from(rollenWithPK.values(), (value: RolleWithPK) => {
            return value.rolle;
        });
        const rollenIdWithSPReference: Option<string> = await this.getAnyRolleReferencesEmailServiceProvider(rollen);
        if (rollenIdWithSPReference) {
            const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findEnabledByPerson(event.personId);
            if (existingEmail) {
                this.logger.info(
                    `Existing email found for personId:${event.personId}, address:${existingEmail.address}`,
                );
                if (existingEmail.enabledOrRequested) {
                    existingEmail.disable();
                    const persistenceResult: EmailAddress<true> | DomainError =
                        await this.emailRepo.save(existingEmail);
                    if (persistenceResult instanceof EmailAddress) {
                        this.logger.info(`Disabled and saved address:${persistenceResult.address}`);
                    } else {
                        this.logger.error(`Could not disable email, error is ${persistenceResult.message}`);
                    }
                }
            }
            const pkForRolleWithSPReference: RolleWithPK | undefined = rollenWithPK.get(rollenIdWithSPReference);
            if (pkForRolleWithSPReference) {
                if (existingEmail) {
                    await this.changeEmail(
                        event.personId,
                        pkForRolleWithSPReference.personenkontext.organisationId,
                        existingEmail,
                    );
                } else {
                    await this.createNewEmail(event.personId, pkForRolleWithSPReference.personenkontext.organisationId);
                }
            }
        } else {
            this.logger.info(`Renamed person with personId:${event.personId} has no SP with Email, nothing to do`);
        }
    }

    private async getRollenWithPKForPerson(personId: PersonID): Promise<Map<string, RolleWithPK>> {
        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        const rollenIdPKMap: Map<string, Personenkontext<true>> = new Map<string, Personenkontext<true>>();

        for (const personenkontext of personenkontexte) {
            rollenIdPKMap.set(personenkontext.rolleId, personenkontext);
        }
        const rollenIds: string[] = Array.from(rollenIdPKMap.keys(), (value: string) => {
            return value;
        });
        const rollenMap: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIds);

        const resMap: Map<string, RolleWithPK> = new Map<string, RolleWithPK>();
        rollenIds.forEach((rollenId: string) => {
            const pk: Personenkontext<true> | undefined = rollenIdPKMap.get(rollenId);
            const rolle: Rolle<true> | undefined = rollenMap.get(rollenId);
            if (pk && rolle) {
                resMap.set(rollenId, {
                    rolle: rolle,
                    personenkontext: pk,
                });
            }
        });

        return resMap;
    }

    @EventHandler(PersonenkontextCreatedMigrationEvent)
    public async handlePersonenkontextCreatedMigrationEvent(
        event: PersonenkontextCreatedMigrationEvent,
    ): Promise<void> {
        this.logger.info(
            `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Received PersonenkontextCreatedMigrationEvent`,
        );
        if (
            event.email &&
            event.createdKontextRolle.rollenart == RollenArt.LEHR &&
            event.migrationRunType === PersonenkontextMigrationRuntype.STANDARD
        ) {
            this.logger.info(
                `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Rollenart is LEHR, trying to persist Email`,
            );
            const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findEnabledByPerson(
                event.createdKontext.personId,
            );
            if (!existingEmail) {
                const newEmail: EmailAddress<false> = EmailAddress.createNew(
                    event.createdKontext.personId,
                    event.email,
                    EmailAddressStatus.ENABLED,
                );
                const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(newEmail);

                if (persistenceResult instanceof DomainError) {
                    return this.logger.error(
                        `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Could not persist existing email, error is ${persistenceResult.message}`,
                    );
                } else {
                    return this.logger.info(
                        `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Successfully persisted Email ${persistenceResult.address}`,
                    );
                }
            } else {
                return this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Aborting persist Email Operation, Email already exists`,
                );
            }
        } else {
            if (event.migrationRunType !== PersonenkontextMigrationRuntype.STANDARD) {
                this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / No Action because PersonenkontextMigrationRuntype is Not STANDARD`,
                );
                return;
            }
            if (event.createdKontextRolle.rollenart !== RollenArt.LEHR) {
                this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / No Action because Rollenart is Not LEHR`,
                );
                return;
            }
        }
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

    private async getAnyRolleReferencesEmailServiceProvider(rollen: Rolle<true>[]): Promise<Option<string>> {
        const pro: Promise<Option<string>>[] = rollen.map((rolle: Rolle<true>) =>
            this.rolleReferencesEmailServiceProvider(rolle),
        );
        const rolleIds: Option<string>[] = await Promise.all(pro);

        for (const rolleId of rolleIds) {
            if (rolleId) return rolleId;
        }

        return undefined;
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

    @EventHandler(OxMetadataInKeycloakChangedEvent)
    public async handleOxMetadataInKeycloakChangedEvent(event: OxMetadataInKeycloakChangedEvent): Promise<void> {
        this.logger.info(
            `Received OxMetadataInKeycloakChangedEvent personId:${event.personId}, keycloakUsername: ${event.keycloakUsername}, userName:${event.oxUserName}, contextName:${event.oxContextName}, email:${event.emailAddress}`,
        );
        const email: Option<EmailAddress<true>> = await this.emailRepo.findRequestedByPerson(event.personId);

        if (!email) {
            return this.logger.error(
                `Cannot find requested email-address for person with personId:${event.personId}, enabling not possible`,
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
        email.oxUserID = event.oxUserId;
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email);

        if (persistenceResult instanceof DomainError) {
            return this.logger.error(`Could not enable email, error is ${persistenceResult.message}`);
        } else {
            return this.logger.info(`Changed email-address:${persistenceResult.address} from REQUESTED to ENABLED`);
        }
    }

    private async handlePerson(personId: PersonID): Promise<void> {
        const rolleIdPKMap: Map<string, Personenkontext<true>> = new Map<string, Personenkontext<true>>();

        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        const rollenIds: string[] = [];
        personenkontexte.forEach((pk: Personenkontext<true>) => {
            rolleIdPKMap.set(pk.rolleId, pk);
            rollenIds.push(pk.rolleId);
        });
        const rollenMap: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIds);
        const rollen: Rolle<true>[] = Array.from(rollenMap.values(), (value: Rolle<true>) => {
            return value;
        });

        const rollenIdWithSPReference: Option<string> = await this.getAnyRolleReferencesEmailServiceProvider(rollen);

        if (rollenIdWithSPReference) {
            const pkOfRolleWithSPReference: Personenkontext<true> | undefined =
                rolleIdPKMap.get(rollenIdWithSPReference);
            if (!pkOfRolleWithSPReference) {
                this.logger.error(
                    `Rolle with id:${rollenIdWithSPReference} references SP, but the wrapping PK could not be found`,
                );
                return;
            }
            this.logger.info(`Person with id:${personId} needs an email, creating or enabling address`);
            await this.createOrEnableEmail(personId, pkOfRolleWithSPReference.organisationId);
        } else {
            //currently no else for calling disablingEmail is necessary, emails are only disabled, when the person is deleted not by PK-events
            this.logger.info(`Person with id:${personId} does not need an email`);
        }
    }

    private async createOrEnableEmail(personId: PersonID, organisationId: OrganisationID): Promise<void> {
        const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findEnabledByPerson(personId);

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
            await this.createNewEmail(personId, organisationId);
        }
    }

    private async createAndPersistFailedEmailAddress(personId: PersonID): Promise<void> {
        const personIdAndTimestamp: string = personId + '-' + Date.now();
        const failedEmailAddress: EmailAddress<false> = EmailAddress.createNew(
            personId,
            personIdAndTimestamp,
            EmailAddressStatus.FAILED,
        );

        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(failedEmailAddress);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted email with FAILED status for address:${persistenceResult.address}`,
            );
        } else {
            this.logger.error(`Could not persist email, error is ${persistenceResult.message}`);
        }
    }

    private async createNewEmail(personId: PersonID, organisationId: OrganisationID): Promise<void> {
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNew(personId, organisationId);
        if (!email.ok) {
            await this.createAndPersistFailedEmailAddress(personId);
            return this.logger.error(`Could not create email, error is: ${email.error.message}`);
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted email with REQUEST status for address:${persistenceResult.address}`,
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

    private async changeEmail(
        personId: PersonID,
        organisationId: OrganisationID,
        oldEmail: EmailAddress<true>,
    ): Promise<void> {
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNew(personId, organisationId);
        if (!email.ok) {
            await this.createAndPersistFailedEmailAddress(personId);

            return this.logger.error(`Could not create change-email, error is ${email.error.message}`);
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted change-email with REQUEST status for address:${persistenceResult.address}`,
            );
            this.eventService.publish(
                new EmailAddressChangedEvent(
                    personId,
                    oldEmail.id,
                    oldEmail.address,
                    persistenceResult.id,
                    persistenceResult.address,
                ),
            );
        } else {
            this.logger.error(`Could not persist change-email, error is ${persistenceResult.message}`);
        }
    }

    private async rolleReferencesEmailServiceProvider(rolle: Rolle<true>): Promise<Option<string>> {
        const serviceProviderMap: Map<string, ServiceProvider<true>> = await this.serviceProviderRepo.findByIds(
            rolle.serviceProviderIds,
        );
        const serviceProviders: ServiceProvider<true>[] = Array.from(
            serviceProviderMap.values(),
            (value: ServiceProvider<true>) => {
                return value;
            },
        );

        const references: boolean = serviceProviders.some(
            (sp: ServiceProvider<true>) => sp.kategorie === ServiceProviderKategorie.EMAIL,
        );

        if (references) return rolle.id;

        return undefined;
    }
}
