import { Injectable } from '@nestjs/common';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { EventHandler } from '../../eventbus/decorators/event-handler.decorator.js';
import { LdapClientService, PersonData } from './ldap-client.service.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { RollenArt } from '../../../modules/rolle/domain/rolle.enums.js';
import { SchuleDeletedEvent } from '../../../shared/events/schule-deleted.event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { PersonenkontextMigrationRuntype } from '../../../modules/personenkontext/domain/personenkontext.enums.js';

@Injectable()
export class LdapEventHandler {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly ldapClientService: LdapClientService,
    ) {}

    @EventHandler(SchuleCreatedEvent)
    public async handleSchuleCreatedEvent(event: SchuleCreatedEvent): Promise<void> {
        this.logger.info(`Received SchuleCreatedEvent, organisationId:${event.organisationId}`);

        if (!event.kennung) {
            return this.logger.error('Schule has no kennung. Aborting.');
        }
        this.logger.info(`Kennung of organisation is:${event.kennung}`);

        this.logger.info(`Call LdapClientService because ${event.name} type is SCHULE`);
        const creationResult: Result<void> = await this.ldapClientService.createOrganisation({
            kennung: event.kennung,
        });
        if (!creationResult.ok) {
            this.logger.error(creationResult.error.message);
        }
    }

    @EventHandler(SchuleDeletedEvent)
    public async handleSchuleDeletedEvent(event: SchuleDeletedEvent): Promise<void> {
        this.logger.info(`Received SchuleDeletedEvent, organisationId:${event.organisationId}`);

        if (!event.kennung) {
            return this.logger.error('Schule has no kennung. Aborting.');
        }
        this.logger.info(`Kennung of organisation is:${event.kennung}`);
        this.logger.info(`Call LdapClientService because ${event.name} type is SCHULE`);
        const creationResult: Result<void> = await this.ldapClientService.deleteOrganisation({
            kennung: event.kennung,
        });
        if (!creationResult.ok) {
            this.logger.error(creationResult.error.message);
        }
    }

    @EventHandler(PersonDeletedEvent)
    public async handlePersonDeletedEvent(event: PersonDeletedEvent): Promise<void> {
        this.logger.info(`Received PersonenkontextDeletedEvent, personId:${event.personId}`);
        const deletionResult: Result<PersonID> = await this.ldapClientService.deleteLehrerByPersonId(event.personId);
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
            const isLehrerExistingResult: Result<boolean> = await this.ldapClientService.isLehrerExisting(
                event.createdKontextPerson.referrer,
                event.createdKontextOrga.kennung,
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
                {
                    kennung: event.createdKontextOrga.kennung,
                },
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

    @EventHandler(PersonenkontextUpdatedEvent)
    public async handlePersonenkontextUpdatedEvent(event: PersonenkontextUpdatedEvent): Promise<void> {
        this.logger.info(
            `Received PersonenkontextUpdatedEvent, personId:${event.person.id}, new personenkontexte: ${event.newKontexte.length}, deleted personenkontexte: ${event.removedKontexte.length}`,
        );

        // Delete all removed personenkontexte if rollenart === LEHR
        await Promise.allSettled(
            event.removedKontexte
                .filter((pk: PersonenkontextEventKontextData) => pk.rolle === RollenArt.LEHR)
                .map(async (pk: PersonenkontextEventKontextData) => {
                    this.logger.info(`Call LdapClientService because rollenArt is LEHR, pkId: ${pk.id}`);
                    const deletionResult: Result<PersonData> = await this.ldapClientService.deleteLehrer(event.person, {
                        kennung: pk.orgaKennung,
                    });
                    if (!deletionResult.ok) {
                        this.logger.error(deletionResult.error.message);
                    }
                }),
        );

        // Create personenkontexte if rollenart === LEHR
        await Promise.allSettled(
            event.newKontexte
                .filter((pk: PersonenkontextEventKontextData) => pk.rolle === RollenArt.LEHR)
                .map(async (pk: PersonenkontextEventKontextData) => {
                    this.logger.info(`Call LdapClientService because rollenArt is LEHR`);
                    const creationResult: Result<PersonData> = await this.ldapClientService.createLehrer(event.person, {
                        kennung: pk.orgaKennung,
                    });
                    if (!creationResult.ok) {
                        this.logger.error(creationResult.error.message);
                    }
                }),
        );
    }

    @EventHandler(EmailAddressGeneratedEvent)
    public async handleEmailAddressGeneratedEvent(event: EmailAddressGeneratedEvent): Promise<void> {
        this.logger.info(
            `Received EmailAddressGeneratedEvent, personId:${event.personId}, emailAddress: ${event.address}`,
        );
        await this.ldapClientService.changeEmailAddressByPersonId(event.personId, event.address);
    }
}
