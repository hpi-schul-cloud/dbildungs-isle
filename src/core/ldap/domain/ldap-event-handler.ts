import { Injectable } from '@nestjs/common';
import { EventHandler } from '../../eventbus/decorators/event-handler.decorator.js';
import { LdapClientService, PersonData } from './ldap-client.service.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import { PersonenkontextMigrationRuntype } from '../../../modules/personenkontext/domain/personenkontext.enums.js';
import { LdapEmailDomainError } from '../error/ldap-email-domain.error.js';
import { EmailAddressChangedEvent } from '../../../shared/events/email-address-changed.event.js';
import { EventService } from '../../eventbus/services/event.service.js';
import { LdapPersonEntryRenamedEvent } from '../../../shared/events/ldap-person-entry-renamed.event.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';

@Injectable()
export class LdapEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly ldapClientService: LdapClientService,
        private readonly organisationRepository: OrganisationRepository,
        private readonly eventService: EventService,
    ) {}

    private async getEmailDomainForOrganisationId(organisationId: OrganisationID): Promise<Result<string>> {
        const emailDomain: string | undefined =
            await this.organisationRepository.findEmailDomainForOrganisation(organisationId);
        if (emailDomain)
            return {
                ok: true,
                value: emailDomain,
            };
        return { ok: false, error: new LdapEmailDomainError() };
    }

    @EventHandler(PersonDeletedEvent)
    public async handlePersonDeletedEvent(event: PersonDeletedEvent): Promise<void> {
        this.logger.info(
            `Received PersonenkontextDeletedEvent, personId:${event.personId}, referrer:${event.referrer}`,
        );
        const deletionResult: Result<PersonID> = await this.ldapClientService.deleteLehrerByReferrer(event.referrer);
        if (!deletionResult.ok) {
            this.logger.error(deletionResult.error.message);
        }
    }

    @EventHandler(PersonenkontextCreatedMigrationEvent)
    public async handlePersonenkontextCreatedMigrationEvent(
        event: PersonenkontextCreatedMigrationEvent,
    ): Promise<void> {
        this.logger.info(
            `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Received PersonenkontextCreatedMigrationEvent`,
        );

        if (
            event.createdKontextRolle.rollenart == RollenArt.LEHR &&
            event.migrationRunType === PersonenkontextMigrationRuntype.STANDARD
        ) {
            this.logger.info(
                `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / RollenArt is LEHR, trying to create Lehrer`,
            );
            if (!event.createdKontextPerson.referrer) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Username missing`,
                );
                return;
            }
            if (!event.createdKontextOrga.kennung) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Orga Kennung missing`,
                );
                return;
            }
            const emailDomain: Result<string> = await this.getEmailDomainForOrganisationId(event.createdKontextOrga.id);
            if (!emailDomain.ok) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Aborting createLehrer Operation, No valid emailDomain for organisation`,
                );
                return;
            }
            const isLehrerExistingResult: Result<boolean> = await this.ldapClientService.isLehrerExisting(
                event.createdKontextPerson.referrer,
                emailDomain.value,
            );
            if (!isLehrerExistingResult.ok) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Check Lehrer existing call failed: ${isLehrerExistingResult.error.message}`,
                );
                return;
            }

            if (isLehrerExistingResult.value == true) {
                this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Aborting createLehrer Operation, LDAP Entry already exists`,
                );
                return;
            }

            const personData: PersonData = {
                id: event.createdKontextPerson.id,
                vorname: event.createdKontextPerson.vorname,
                familienname: event.createdKontextPerson.familienname,
                referrer: event.createdKontextPerson.referrer,
                ldapEntryUUID: event.createdKontextPerson.id, //Matches The legacy ldapEntryUUID
            };

            const creationResult: Result<PersonData> = await this.ldapClientService.createLehrer(
                personData,
                emailDomain.value,
                event.createdKontextOrga.kennung,
                event.email,
            );
            if (!creationResult.ok) {
                this.logger.error(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Create Lehrer Operation failed: ${creationResult.error.message}`,
                );
                return;
            }
            this.logger.info(
                `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Successfully created LDAP Entry Lehrer`,
            );
        } else {
            if (event.migrationRunType !== PersonenkontextMigrationRuntype.STANDARD) {
                this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Do Nothing because PersonenkontextMigrationRuntype is Not STANDARD`,
                );
            } else if (event.createdKontextRolle.rollenart !== RollenArt.LEHR) {
                this.logger.info(
                    `MIGRATION: Create Kontext Operation / personId: ${event.createdKontextPerson.id} ;  orgaId: ${event.createdKontextOrga.id} ;  rolleId: ${event.createdKontextRolle.id} / Do Nothing because Rollenart is Not LEHR`,
                );
            }
        }
    }

    @EventHandler(PersonRenamedEvent)
    public async personRenamedEventHandler(event: PersonRenamedEvent): Promise<void> {
        this.logger.info(
            `Received PersonRenamedEvent, personId:${event.personId}, referrer:${event.referrer}, oldReferrer:${event.oldReferrer}`,
        );
        const modifyResult: Result<PersonID> = await this.ldapClientService.modifyPersonAttributes(
            event.oldReferrer,
            event.vorname,
            event.familienname,
            event.referrer,
        );
        if (!modifyResult.ok) {
            this.logger.error(modifyResult.error.message);
            return;
        }

        this.logger.info(`Successfully modified person attributes in LDAP for personId:${event.personId}`);
        this.eventService.publish(LdapPersonEntryRenamedEvent.fromPersonRenamedEvent(event));
    }

    @EventHandler(PersonenkontextUpdatedEvent)
    public async handlePersonenkontextUpdatedEvent(event: PersonenkontextUpdatedEvent): Promise<void> {
        this.logger.info(
            `Received PersonenkontextUpdatedEvent, personId:${event.person.id}, referrer:${event.person.referrer}, newPKs:${event.newKontexte.length}, removedPKs:${event.removedKontexte.length}`,
        );

        await Promise.allSettled(
            event.removedKontexte
                .filter(
                    (pk: PersonenkontextEventKontextData) =>
                        pk.rolle === RollenArt.LEHR && !this.hatZuordnungZuOrganisationNachLoeschen(event, pk),
                )
                .map((pk: PersonenkontextEventKontextData) => {
                    if (!pk.orgaKennung) {
                        return Promise.reject(new Error('Organisation has no Kennung'));
                    }
                    return this.getEmailDomainForOrganisationId(pk.orgaId)
                        .catch((error: Error) => {
                            this.logger.error(`Error in getEmailDomainForOrganisationId: ${error.message}`);
                            return Promise.reject(error);
                        })
                        .then((emailDomain: Result<string>) => {
                            if (emailDomain.ok) {
                                this.logger.info(`Call LdapClientService because rollenArt is LEHR, pkId: ${pk.id}`);
                                return this.ldapClientService
                                    .removePersonFromGroupByUsernameAndKennung(
                                        event.person.referrer!,
                                        pk.orgaKennung!,
                                        emailDomain.value,
                                    )
                                    .then((removeFromGroupResult: Result<boolean>) => {
                                        if (!removeFromGroupResult.ok) {
                                            this.logger.error(removeFromGroupResult.error.message);
                                        }
                                        return removeFromGroupResult;
                                    })
                                    .catch((error: Error) => {
                                        this.logger.error(`Error in removePersonFromGroup: ${error.message}`);
                                        return Promise.reject(error);
                                    });
                            } else {
                                this.logger.error(
                                    `LdapClientService removePersonFromGroup NOT called, because organisation:${pk.orgaId} has no valid emailDomain`,
                                );
                                return Promise.reject(new Error('Invalid email domain'));
                            }
                        });
                }),
        );

        // Create personenkontexte if rollenart === LEHR
        await Promise.allSettled(
            event.newKontexte
                .filter((pk: PersonenkontextEventKontextData) => pk.rolle === RollenArt.LEHR)
                .map((pk: PersonenkontextEventKontextData) => {
                    this.logger.info(`Call LdapClientService because rollenArt is LEHR`);
                    if (!pk.orgaKennung) {
                        return Promise.reject(new Error('Organisation has no Kennung'));
                    }
                    return this.getEmailDomainForOrganisationId(pk.orgaId)
                        .catch((error: Error) => {
                            this.logger.error(`Error in getEmailDomainForOrganisationId: ${error.message}`);
                            return Promise.reject(error);
                        })
                        .then((emailDomain: Result<string>) => {
                            if (emailDomain.ok) {
                                return this.ldapClientService
                                    .createLehrer(event.person, emailDomain.value, pk.orgaKennung!)
                                    .then((creationResult: Result<PersonData>) => {
                                        if (!creationResult.ok) {
                                            this.logger.error(creationResult.error.message);
                                        }
                                        return creationResult;
                                    })
                                    .catch((error: Error) => {
                                        this.logger.error(`Error in createLehrer: ${error.message}`);
                                        return Promise.reject(error);
                                    });
                            } else {
                                this.logger.error(
                                    `LdapClientService createLehrer NOT called, because organisation:${pk.orgaId} has no valid emailDomain`,
                                );
                                return Promise.reject({ ok: false, error: new Error('Invalid email domain') });
                            }
                        });
                }),
        );
    }

    @EventHandler(EmailAddressGeneratedEvent)
    public async handleEmailAddressGeneratedEvent(event: EmailAddressGeneratedEvent): Promise<void> {
        this.logger.info(
            `Received EmailAddressGeneratedEvent, personId:${event.personId}, referrer:${event.referrer}, emailAddress:${event.address}`,
        );

        await this.ldapClientService.changeEmailAddressByPersonId(event.personId, event.referrer, event.address);
    }

    @EventHandler(EmailAddressChangedEvent)
    public async handleEmailAddressChangedEvent(event: EmailAddressChangedEvent): Promise<void> {
        this.logger.info(
            `Received EmailAddressChangedEvent, personId:${event.personId}, newEmailAddress: ${event.newAddress}, oldEmailAddress: ${event.oldAddress}`,
        );

        await this.ldapClientService.changeEmailAddressByPersonId(event.personId, event.referrer, event.newAddress);
    }

    public hatZuordnungZuOrganisationNachLoeschen(
        personenkontextUpdatedEvent: PersonenkontextUpdatedEvent,
        personenkontextEventKontextData: PersonenkontextEventKontextData,
    ): boolean {
        const orgaId: OrganisationID = personenkontextEventKontextData.orgaId;
        const currentOrgaIds: OrganisationID[] = personenkontextUpdatedEvent.currentKontexte.map(
            (pk: PersonenkontextEventKontextData) => pk.orgaId,
        );
        return currentOrgaIds.includes(orgaId);
    }
}
