import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { EventHandler } from '../../../core/eventbus/decorators/event-handler.decorator.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { ServiceProviderKategorie } from '../../service-provider/domain/service-provider.enum.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { DomainError, EntityNotFoundError } from '../../../shared/error/index.js';
import { OrganisationID, PersonID, PersonReferrer } from '../../../shared/types/index.js';
import { EmailAddressEntity } from '../persistence/email-address.entity.js';
import { EmailAddressNotFoundError } from '../error/email-address-not-found.error.js';
import { EmailRepo } from '../persistence/email.repo.js';
import { EmailFactory } from './email.factory.js';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
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
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { EmailAddressAlreadyExistsEvent } from '../../../shared/events/email-address-already-exists.event.js';
import { EmailAddressDisabledEvent } from '../../../shared/events/email-address-disabled.event.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { PersonDomainError } from '../../person/domain/person-domain.error.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { DisabledEmailAddressGeneratedEvent } from '../../../shared/events/disabled-email-address-generated.event.js';
import { DisabledOxUserChangedEvent } from '../../../shared/events/disabled-ox-user-changed.event.js';
import { LdapPersonEntryRenamedEvent } from '../../../shared/events/ldap-person-entry-renamed.event.js';

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
        private readonly organisationRepository: OrganisationRepository,
        private readonly personRepository: PersonRepository,
        private readonly eventService: EventService,
    ) {}

    /*
     * Method 'handlePersonRenamedEvent' is replaced by 'handleLdapPersonEntryRenamedEvent' to handle the operations regarding person-renaming synchronously after each other,
     * first in LdapEventHandler then here in EmailEventHandler.
     */

    @EventHandler(LdapPersonEntryRenamedEvent)
    public async handleLdapPersonEntryRenamedEvent(event: LdapPersonEntryRenamedEvent): Promise<void> {
        this.logger.info(
            `Received LdapPersonEntryRenamedEvent, personId:${event.personId}, referrer:${event.referrer}, oldReferrer:${event.oldReferrer}`,
        );
        const rollenWithPK: Map<string, RolleWithPK> = await this.getRollenWithPKForPerson(event.personId);
        const rollen: Rolle<true>[] = Array.from(rollenWithPK.values(), (value: RolleWithPK) => {
            return value.rolle;
        });
        const rollenIdWithSPReference: Option<string> = await this.getAnyRolleReferencesEmailServiceProvider(rollen);
        if (rollenIdWithSPReference) {
            const existingEmail: Option<EmailAddress<true>> = await this.emailRepo.findEnabledByPerson(event.personId);
            if (existingEmail) {
                this.logger.info(
                    `Existing email found for personId:${event.personId}, address:${existingEmail.address}, referrer:${event.referrer}`,
                );
                if (existingEmail.enabledOrRequested) {
                    existingEmail.disable();
                    const persistenceResult: EmailAddress<true> | DomainError =
                        await this.emailRepo.save(existingEmail);
                    if (persistenceResult instanceof EmailAddress) {
                        this.logger.info(
                            `DISABLED and saved address:${persistenceResult.address}, personId:${event.personId}, referrer:${event.referrer}`,
                        );
                    } else {
                        this.logger.error(
                            `Could not DISABLE email, personId:${event.personId}, referrer:${event.referrer}, error:${persistenceResult.message}`,
                        );
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
            const existingDisabledEmails: EmailAddress<true>[] = await this.emailRepo.findByPersonSortedByUpdatedAtDesc(
                event.personId,
                EmailAddressStatus.DISABLED,
            );
            if (existingDisabledEmails.length === 0 || !existingDisabledEmails[0]) {
                return this.logger.info(
                    `Renamed person with personId:${event.personId}, referrer:${event.referrer} has no SP with Email and no existing DISABLED addresses, nothing to do`,
                );
            }
            const mostRecentDisabledEmail: EmailAddress<true> = existingDisabledEmails[0];
            const splitted: string[] = mostRecentDisabledEmail.address.split('@');
            if (!splitted[1]) {
                return this.logger.error(
                    `Could not extract domain from existing DISABLED email-address, personId:${event.personId}, referrer:${event.referrer}`,
                );
            }
            await this.createNewDisabledEmail(event.personId, splitted[1]);
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
                        `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Could not persist existing email, error:${persistenceResult.message}`,
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
        this.logger.info(
            `Received PersonenkontextUpdatedEvent, personId:${event.person.id}, referrer:${event.person.referrer}, newPKs:${event.newKontexte.length}, removedPKs:${event.removedKontexte.length}`,
        );

        await this.handlePerson(event.person.id, event.person.referrer, event.removedKontexte);
    }

    // this method cannot make use of handlePerson(personId) method, because personId is already null when event is received
    @EventHandler(PersonDeletedEvent)
    public async handlePersonDeletedEvent(event: PersonDeletedEvent): Promise<void> {
        this.logger.info(`Received PersonDeletedEvent, personId:${event.personId}, referrer:${event.referrer}`);
        //Setting person_id to null in Email table is done via deleteRule, not necessary here

        if (!event.emailAddress) {
            return this.logger.info(
                `Cannot deactivate email-address, personId:${event.personId}, referrer:${event.referrer}, person did not have an email-address`,
            );
        }
        const deactivationResult: EmailAddressEntity | EmailAddressNotFoundError =
            await this.emailRepo.deactivateEmailAddress(event.emailAddress);
        if (deactivationResult instanceof EmailAddressNotFoundError) {
            return this.logger.error(
                `Deactivation of email-address:${event.emailAddress} failed, personId:${event.personId}, referrer:${event.referrer}`,
            );
        }

        return this.logger.info(
            `Successfully deactivated email-address:${event.emailAddress}, personId:${event.personId}, referrer:${event.referrer}`,
        );
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
        this.logger.info(`Received RolleUpdatedEvent, rolleId:${event.rolleId}, rollenArt:${event.rollenart}`);

        const personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByRolle(
            event.rolleId,
        );

        //const personIdReferrerSet: Set<[PersonID, PersonReferrer]> = new Set<[PersonID, PersonReferrer]>();

        const personIdReferrerMap: Map<PersonID, PersonReferrer | undefined> = new Map<
            PersonID,
            PersonReferrer | undefined
        >();
        const personIdsSet: Set<PersonID> = new Set<PersonID>();
        personenkontexte.forEach((pk: Personenkontext<true>) => {
            personIdsSet.add(pk.personId);
            personIdReferrerMap.set(pk.personId, pk.referrer);
        });
        const distinctPersonIds: PersonID[] = Array.from(personIdsSet.values());

        this.logger.info(`RolleUpdatedEvent affects:${distinctPersonIds.length} persons`);

        const handlePersonPromises: Promise<void>[] = distinctPersonIds.map((personId: PersonID) => {
            return this.handlePerson(personId, personIdReferrerMap.get(personId));
        });

        await Promise.all(handlePersonPromises);
    }

    @EventHandler(OxMetadataInKeycloakChangedEvent)
    public async handleOxMetadataInKeycloakChangedEvent(event: OxMetadataInKeycloakChangedEvent): Promise<void> {
        this.logger.info(
            `Received OxMetadataInKeycloakChangedEvent personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, oxUserName:${event.oxUserName}, contextName:${event.oxContextName}, email:${event.emailAddress}`,
        );
        const email: Option<EmailAddress<true>> = await this.emailRepo.findRequestedByPerson(event.personId);

        if (!email) {
            return this.logger.info(
                `Cannot find REQUESTED email-address for person with personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, enabling not necessary`,
            );
        }

        if (email.address !== event.emailAddress) {
            this.logger.warning(
                `Mismatch between REQUESTED(${email.address}) and received(${event.emailAddress}) address from OX, personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}`,
            );
            this.logger.warning(
                `Overriding ${email.address} with ${event.emailAddress}) from OX, personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}`,
            );
            email.setAddress(event.emailAddress);
        }

        email.enable();
        email.oxUserID = event.oxUserId;
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email);

        if (persistenceResult instanceof DomainError) {
            return this.logger.error(
                `Could not ENABLE email for personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, error:${persistenceResult.message}`,
            );
        } else {
            return this.logger.info(
                `Changed email-address:${persistenceResult.address} from REQUESTED to ENABLED, personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}`,
            );
        }
    }

    @EventHandler(DisabledOxUserChangedEvent)
    public async handleDisabledOxUserChangedEvent(event: DisabledOxUserChangedEvent): Promise<void> {
        this.logger.info(
            `Received DisabledOxUserChangedEvent personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, oxUserName:${event.oxUserName}, contextName:${event.oxContextName}, email:${event.primaryEmail}`,
        );
        const email: Option<EmailAddress<true>> = await this.emailRepo.findRequestedByPerson(event.personId);

        if (!email) {
            return this.logger.error(
                `Cannot find REQUESTED email-address for person with personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, DISABLING not possible`,
            );
        }

        email.disable();
        email.oxUserID = event.oxUserId;
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email);

        if (persistenceResult instanceof DomainError) {
            return this.logger.error(
                `Could not DISABLE email for personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}, error:${persistenceResult.message}`,
            );
        } else {
            return this.logger.info(
                `Changed email-address:${persistenceResult.address} from REQUESTED to DISABLED, personId:${event.personId}, referrer:${event.keycloakUsername}, oxUserId:${event.oxUserId}`,
            );
        }
    }

    private async getPersonReferrerOrError(personId: PersonID): Promise<Result<PersonReferrer>> {
        const person: Option<Person<true>> = await this.personRepository.findById(personId);

        if (!person) {
            this.logger.error(`Person Could Not Be Found For personId:${personId}`);
            return {
                ok: false,
                error: new EntityNotFoundError('Person', personId),
            };
        }
        if (!person.referrer) {
            this.logger.error(`Referrer Could Not Be Found For personId:${personId}`);
            return {
                ok: false,
                error: new PersonDomainError('Person-Referrer NOT defined', personId),
            };
        }

        this.logger.info(`Found referrer:${person.referrer} for personId:${personId}`);

        return {
            ok: true,
            value: person.referrer,
        };
    }

    private async handlePerson(
        personId: PersonID,
        referrer: PersonReferrer | undefined,
        removedKontexte?: PersonenkontextEventKontextData[],
    ): Promise<void> {
        // Map to store combinations of rolleId and organisationId as the key
        const rolleIdPKMap: Map<string, Personenkontext<true>> = new Map<string, Personenkontext<true>>();

        // Retrieve all personenkontexte for the given personId
        let personenkontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        // in case PersonenkontextUpdateEvent is result of PersonDeletion, no PK that is going to be removed, should trigger createOrEnableEmail
        if (removedKontexte) {
            personenkontexte = personenkontexte.filter((pk: Personenkontext<true>) =>
                removedKontexte.every((removedPK: PersonenkontextEventKontextData) => removedPK.id !== pk.id),
            );
        }

        // Array to hold the role IDs
        const rollenIds: string[] = [];

        // Process each personenkontext and add it to the map and array
        personenkontexte.forEach((pk: Personenkontext<true>) => {
            // Use combination of rolleId and organisationId as the key
            const key: string = `${pk.rolleId}-${pk.organisationId}`;
            rolleIdPKMap.set(key, pk);
            rollenIds.push(pk.rolleId);
        });

        // Retrieve role details based on the role IDs
        const rollenMap: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIds);
        const rollen: Rolle<true>[] = Array.from(rollenMap.values());

        // Check if any role has a reference to an SP for email service provider
        const rollenIdWithSPReference: Option<string> = await this.getAnyRolleReferencesEmailServiceProvider(rollen);

        if (rollenIdWithSPReference) {
            await this.handlePersonWithEmailSPReference(
                personId,
                referrer,
                personenkontexte,
                rollenIdWithSPReference,
                rolleIdPKMap,
            );
        } else {
            // If no role references an SP, disable any existing emails
            await this.handlePersonWithoutEmailSPReference(personId, referrer);
        }
    }

    private async handlePersonWithEmailSPReference(
        personId: PersonID,
        referrer: PersonReferrer | undefined,
        personenkontexte: Personenkontext<true>[],
        rollenIdWithSPReference: string,
        rolleIdPKMap: Map<string, Personenkontext<true>>,
    ): Promise<void> {
        // Array to store matching Personenkontext objects for further processing
        const pkOfRolleWithSPReferenceList: Personenkontext<true>[] = [];

        // Check all combinations of rolleId and organisationId for this role
        for (const pk of personenkontexte) {
            if (pk.rolleId === rollenIdWithSPReference) {
                const key: string = `${pk.rolleId}-${pk.organisationId}`;
                const pkFromMap: Personenkontext<true> | undefined = rolleIdPKMap.get(key);
                if (pkFromMap) {
                    pkOfRolleWithSPReferenceList.push(pkFromMap); // Collect valid matches
                }
            }
        }

        // Process each valid Personenkontext
        if (pkOfRolleWithSPReferenceList.length > 0) {
            this.logger.info(
                `Person with personId:${personId}, referrer:${referrer} needs an email, creating or enabling address`,
            );
            // Iterate over all valid Personenkontext objects and trigger email creation
            for (const pkOfRolleWithSPReference of pkOfRolleWithSPReferenceList) {
                // eslint-disable-next-line no-await-in-loop
                await this.createOrEnableEmail(personId, pkOfRolleWithSPReference.organisationId);
            }
        } else {
            this.logger.error(
                `Rolle with id:${rollenIdWithSPReference} references SP, but no matching Personenkontext was found`,
            );
        }
    }

    private async handlePersonWithoutEmailSPReference(
        personId: PersonID,
        referrer: PersonReferrer | undefined,
    ): Promise<void> {
        const existingEmails: Option<EmailAddress<true>[]> =
            await this.emailRepo.findByPersonSortedByUpdatedAtDesc(personId);

        let anyEmailWasDisabled: boolean = false;
        if (existingEmails) {
            await Promise.allSettled(
                existingEmails
                    .filter((existingEmail: EmailAddress<true>) => !existingEmail.disabled)
                    .map(async (existingEmail: EmailAddress<true>) => {
                        this.logger.info(
                            `Existing email found for personId:${personId}, address:${existingEmail.address}`,
                        );
                        existingEmail.disable();
                        const persistenceResult: EmailAddress<true> | DomainError =
                            await this.emailRepo.save(existingEmail);

                        if (persistenceResult instanceof EmailAddress) {
                            anyEmailWasDisabled = true;
                            this.logger.info(
                                `DISABLED and saved address:${persistenceResult.address}, personId:${personId}, referrer:${referrer}`,
                            );
                        } else {
                            this.logger.error(
                                `Could not DISABLE email, personId:${personId}, referrer:${referrer}, error:${persistenceResult.message}`,
                            );
                        }
                    }),
            );

            if (anyEmailWasDisabled) {
                const person: Option<Person<true>> = await this.personRepository.findById(personId);
                if (!person || !person.referrer) {
                    this.logger.error(
                        `Could not publish EmailAddressDisabledEvent, personId:${personId} has no username`,
                    );
                } else {
                    this.eventService.publish(new EmailAddressDisabledEvent(personId, person.referrer));
                }
            }
        }
    }

    private async getOrganisationKennung(organisationId: OrganisationID): Promise<Result<string>> {
        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(organisationId);
        if (!organisation || !organisation.kennung) {
            this.logger.error(`Could not retrieve orgaKennung, orgaId:${organisationId}`);
            return {
                ok: false,
                error: new EntityNotFoundError('organisation', organisationId),
            };
        }
        return {
            ok: true,
            value: organisation.kennung,
        };
    }

    private async createOrEnableEmail(personId: PersonID, organisationId: OrganisationID): Promise<void> {
        const organisationKennung: Result<string> = await this.getOrganisationKennung(organisationId);
        if (!organisationKennung.ok) return;

        const existingEmails: EmailAddress<true>[] = await this.emailRepo.findByPersonSortedByUpdatedAtDesc(personId);

        if (existingEmails.length > 0) {
            // Publish the EmailAddressAlreadyExistsEvent as the User already has an email.
            // The status of the email is not relevant to adding the user in the OX group.
            this.eventService.publish(new EmailAddressAlreadyExistsEvent(personId, organisationKennung.value));
        }

        const personReferrer: Result<string> = await this.getPersonReferrerOrError(personId);
        if (!personReferrer.ok) {
            return; //error logging is done in getPersonReferrerOrError
        }
        for (const email of existingEmails) {
            if (email.enabled) {
                return this.logger.info(
                    `Existing email for personId:${personId}, referrer:${personReferrer.value} already ENABLED`,
                );
            } else if (email.disabled) {
                // If we find a disabled address, we just enable it again
                email.enable();

                // Will return after the first iteration, so it's not an await in a loop
                // eslint-disable-next-line no-await-in-loop
                const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email);
                if (persistenceResult instanceof EmailAddress) {
                    this.logger.info(
                        `Set REQUESTED status and persisted address:${persistenceResult.address}, personId:${personId}, referrer:${personReferrer.value}`,
                    );
                    this.eventService.publish(
                        new EmailAddressGeneratedEvent(
                            personId,
                            personReferrer.value,
                            persistenceResult.id,
                            persistenceResult.address,
                            persistenceResult.enabled,
                            organisationKennung.value,
                        ),
                    );
                } else {
                    this.logger.error(
                        `Could not ENABLE email for personId:${personId}, referrer:${personReferrer.value}, error:${persistenceResult.message}`,
                    );
                }

                return;
            }
        }
        this.logger.info(
            `No existing email found for personId:${personId}, referrer:${personReferrer.value}, creating a new one`,
        );
        await this.createNewEmail(personId, organisationId);
    }

    private async createAndPersistFailedEmailAddress(
        personId: PersonID,
        referrer: PersonReferrer | undefined,
    ): Promise<void> {
        const personIdAndTimestamp: string = personId + '-' + Date.now();
        const failedEmailAddress: EmailAddress<false> = EmailAddress.createNew(
            personId,
            personIdAndTimestamp,
            EmailAddressStatus.FAILED,
        );

        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(failedEmailAddress);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted email with FAILED status for address:${persistenceResult.address}, personId:${personId}, referrer:${referrer}`,
            );
        } else {
            this.logger.error(
                `Could not persist email for personId:${personId}, referrer:${referrer}, error:${persistenceResult.message}`,
            );
        }
    }

    private async createNewEmail(personId: PersonID, organisationId: OrganisationID): Promise<void> {
        const organisationKennung: Result<string> = await this.getOrganisationKennung(organisationId);
        if (!organisationKennung.ok) return;
        const personReferrer: Result<string> = await this.getPersonReferrerOrError(personId);
        if (!personReferrer.ok) {
            return; //error logging is done in getPersonReferrerOrError
        }
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNew(personId, organisationId);
        if (!email.ok) {
            await this.createAndPersistFailedEmailAddress(personId, personReferrer.value);
            return this.logger.error(
                `Could not create new email for personId:${personId}, referrer:${personReferrer.value}, error:${email.error.message}`,
            );
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted email with REQUEST status for address:${persistenceResult.address}, personId:${personId}, referrer:${personReferrer.value}`,
            );
            this.eventService.publish(
                new EmailAddressGeneratedEvent(
                    personId,
                    personReferrer.value,
                    persistenceResult.id,
                    persistenceResult.address,
                    persistenceResult.enabled,
                    organisationKennung.value,
                ),
            );
        } else {
            this.logger.error(
                `Could not persist email for personId:${personId}, referrer:${personReferrer.value}, error:${persistenceResult.message}`,
            );
        }
    }

    private async createNewDisabledEmail(personId: PersonID, emailDomain: string): Promise<void> {
        const personReferrer: Result<string> = await this.getPersonReferrerOrError(personId);
        if (!personReferrer.ok) {
            return; //error logging is done in getPersonReferrerOrError
        }
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNewFromPersonIdAndDomain(
            personId,
            emailDomain,
        );
        if (!email.ok) {
            await this.createAndPersistFailedEmailAddress(personId, personReferrer.value);
            return this.logger.error(
                `Could not create new and DISABLED email for personId:${personId}, referrer:${personReferrer.value}, error:${email.error.message}`,
            );
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted new email with DISABLED status for address:${persistenceResult.address}, personId:${personId}, referrer:${personReferrer.value}`,
            );
            this.eventService.publish(
                new DisabledEmailAddressGeneratedEvent(
                    personId,
                    personReferrer.value,
                    persistenceResult.id,
                    persistenceResult.address,
                    emailDomain,
                ),
            );
        } else {
            this.logger.error(
                `Could not persist email for personId:${personId}, referrer:${personReferrer.value}, error:${persistenceResult.message}`,
            );
        }
    }

    private async changeEmail(
        personId: PersonID,
        organisationId: OrganisationID,
        oldEmail: EmailAddress<true>,
    ): Promise<void> {
        const organisationKennung: Result<string> = await this.getOrganisationKennung(organisationId);
        if (!organisationKennung.ok) return;
        const personReferrer: Result<string> = await this.getPersonReferrerOrError(personId);
        if (!personReferrer.ok) {
            return; //error logging is done in getPersonReferrerOrError
        }
        const email: Result<EmailAddress<false>> = await this.emailFactory.createNew(personId, organisationId);
        if (!email.ok) {
            await this.createAndPersistFailedEmailAddress(personId, personReferrer.value);

            return this.logger.error(
                `Could not create change-email for personId:${personId}, referrer:${personReferrer.value}, error:${email.error.message}`,
            );
        }
        email.value.request();
        const persistenceResult: EmailAddress<true> | DomainError = await this.emailRepo.save(email.value);
        if (persistenceResult instanceof EmailAddress) {
            this.logger.info(
                `Successfully persisted change-email with REQUEST status for address:${persistenceResult.address}, personId:${personId}, referrer:${personReferrer.value}`,
            );
            this.eventService.publish(
                new EmailAddressChangedEvent(
                    personId,
                    personReferrer.value,
                    oldEmail.id,
                    oldEmail.address,
                    persistenceResult.id,
                    persistenceResult.address,
                    organisationKennung.value,
                ),
            );
        } else {
            this.logger.error(
                `Could not persist change-email for personId:${personId}, referrer:${personReferrer.value}, error:${persistenceResult.message}`,
            );
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
