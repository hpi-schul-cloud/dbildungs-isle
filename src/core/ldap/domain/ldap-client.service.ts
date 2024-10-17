import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../logging/class-logger.js';
import { Attribute, Change, Client, Control, SearchResult } from 'ldapts';
import { LdapEntityType, LdapOrganisationEntry, LdapPersonEntry, LdapRoleEntry } from './ldap.types.js';
import { KennungRequiredForSchuleError } from '../../../modules/organisation/specification/error/kennung-required-for-schule.error.js';
import { LdapClient } from './ldap-client.js';
import { LdapInstanceConfig } from '../ldap-instance-config.js';
import { UsernameRequiredError } from '../../../modules/person/domain/username-required.error.js';
import { Mutex } from 'async-mutex';
import { LdapSearchError } from '../error/ldap-search.error.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EventService } from '../../eventbus/services/event.service.js';
import { LdapPersonEntryChangedEvent } from '../../../shared/events/ldap-person-entry-changed.event.js';

export type PersonData = {
    vorname: string;
    familienname: string;
    id: string;
    referrer?: string;
    ldapEntryUUID?: string;
};

type OrganisationData = {
    kennung?: string;
};

@Injectable()
export class LdapClientService {
    private mutex: Mutex;

    public constructor(
        private readonly ldapClient: LdapClient,
        private readonly ldapInstanceConfig: LdapInstanceConfig,
        private readonly logger: ClassLogger,
        private readonly eventService: EventService,
    ) {
        this.mutex = new Mutex();
    }

    private async bind(): Promise<Result<boolean>> {
        this.logger.info('LDAP: bind');
        try {
            await this.ldapClient
                .getClient()
                .bind(this.ldapInstanceConfig.BIND_DN, this.ldapInstanceConfig.ADMIN_PASSWORD);
            this.logger.info('LDAP: Successfully connected');
            return {
                ok: true,
                value: true,
            };
        } catch (err) {
            const errMsg: string = `Could not connect to LDAP, message: ${JSON.stringify(err)}`;
            this.logger.error(errMsg);
            return { ok: false, error: new Error(errMsg) };
        }
    }

    public async createOrganisation(organisationData: OrganisationData): Promise<Result<void>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: createOrganisation');
            if (!organisationData.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;
            const organisationEntry: LdapOrganisationEntry = {
                ou: organisationData.kennung,
                objectclass: ['organizationalUnit'],
            };
            const roleEntry: LdapRoleEntry = {
                cn: 'lehrer',
                ou: organisationData.kennung,
                objectclass: ['organizationalRole'],
            };
            await client.add(
                `ou=${organisationData.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`,
                organisationEntry,
            );
            this.logger.info(`LDAP: Successfully created organisation ou=${organisationData.kennung}`);

            await client.add(
                `cn=lehrer,ou=${organisationData.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`,
                roleEntry,
            );
            this.logger.info(
                `LDAP: Successfully created corresponding lehrer rolle for ou=${organisationData.kennung}`,
            );

            return { ok: true, value: undefined };
        });
    }

    public async deleteOrganisation(organisationData: OrganisationData): Promise<Result<void>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteOrganisation');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;
            if (!organisationData.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };

            this.logger.info('LDAP: Successfully connected to LDAP');

            await client.del(`cn=lehrer,ou=${organisationData.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`);
            this.logger.info(
                `LDAP: Successfully deleted corresponding lehrer rolle for ou=${organisationData.kennung}`,
            );

            await client.del(`ou=${organisationData.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`);
            this.logger.info(`LDAP: Successfully deleted organisation ou=${organisationData.kennung}`);

            return { ok: true, value: undefined };
        });
    }

    public async createLehrer(
        person: PersonData,
        organisation: OrganisationData,
        mail?: string, //Wird hier erstmal seperat mit reingegeben bis die Umstellung auf primary/alternative erfolgt
    ): Promise<Result<PersonData>> {
        if (!organisation.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };
        if (!person.referrer) {
            return {
                ok: false,
                error: new UsernameRequiredError(
                    `Lehrer ${person.vorname} ${person.familienname} does not have a username`,
                ),
            };
        }
        const lehrerUid: string = this.getLehrerUid(person.referrer, organisation.kennung);
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: createLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultSchule: SearchResult = await client.search(`ou=oeffentlicheSchulen,dc=schule-sh,dc=de`, {
                filter: `(ou=${organisation.kennung})`,
            });

            if (searchResultSchule.searchEntries.length <= 0) {
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.SCHULE),
                };
            }

            const searchResultLehrer: SearchResult = await client.search(
                `cn=lehrer,ou=${organisation.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`,
                {
                    filter: `(uid=${person.referrer})`,
                },
            );
            if (searchResultLehrer.searchEntries.length > 0) {
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }
            const entry: LdapPersonEntry = {
                cn: person.vorname,
                sn: person.familienname,
                objectclass: ['inetOrgPerson', 'univentionMail'],
                mailPrimaryAddress: mail ?? ``,
                mailAlternativeAddress: mail ?? ``,
            };

            const controls: Control[] = [];
            const relaxRulesControlOID: string = '1.3.6.1.4.1.4203.666.5.12';
            entry.entryUUID = person.ldapEntryUUID ?? person.id;
            controls.push(new Control(relaxRulesControlOID));

            await client.add(lehrerUid, entry, controls);
            this.logger.info(`LDAP: Successfully created lehrer ${lehrerUid}`);

            return { ok: true, value: person };
        });
    }

    public async isLehrerExisting(referrer: string, orgaKennung: string): Promise<Result<boolean>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: isLehrerExisting');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(
                `cn=lehrer,ou=${orgaKennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`,
                {
                    filter: `(uid=${referrer})`,
                },
            );
            if (searchResultLehrer.searchEntries.length > 0) {
                return { ok: true, value: true };
            }
            return { ok: true, value: false };
        });
    }

    private getLehrerUid(referrer: string, orgaKennung: string): string {
        return `uid=${referrer},cn=lehrer,ou=${orgaKennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`;
    }

    public async deleteLehrerByPersonId(personId: PersonID): Promise<Result<PersonID>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(`ou=oeffentlicheSchulen,dc=schule-sh,dc=de`, {
                scope: 'sub',
                filter: `(entryUUID=${personId})`,
            });
            if (!searchResultLehrer.searchEntries[0]) {
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }
            await client.del(searchResultLehrer.searchEntries[0].dn);
            this.logger.info(`LDAP: Successfully deleted lehrer by personId:${personId}`);

            return { ok: true, value: personId };
        });
    }

    public async deleteLehrer(person: PersonData, organisation: OrganisationData): Promise<Result<PersonData>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;
            if (!organisation.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };
            if (!person.referrer)
                return {
                    ok: false,
                    error: new UsernameRequiredError(
                        `Lehrer ${person.vorname} ${person.familienname} does not have a username`,
                    ),
                };
            const lehrerUid: string = this.getLehrerUid(person.referrer, organisation.kennung);
            await client.del(lehrerUid);
            this.logger.info(`LDAP: Successfully deleted lehrer ${lehrerUid}`);

            return { ok: true, value: person };
        });
    }

    public async changeEmailAddressByPersonId(personId: PersonID, newEmailAddress: string): Promise<Result<PersonID>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: changeEmailAddress');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResult: SearchResult = await client.search(`ou=oeffentlicheSchulen,dc=schule-sh,dc=de`, {
                scope: 'sub',
                filter: `(entryUUID=${personId})`,
                attributes: ['mailPrimaryAddress', 'mailAlternativeAddress'],
                returnAttributeValues: true,
            });
            if (!searchResult.searchEntries[0]) {
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }

            const currentEmailAddressString: string | undefined = searchResult.searchEntries[0][
                'mailPrimaryAddress'
            ] as string;
            const currentEmailAddress: string = currentEmailAddressString ?? newEmailAddress;

            await client.modify(searchResult.searchEntries[0].dn, [
                new Change({
                    operation: 'replace',
                    modification: new Attribute({ type: 'mailPrimaryAddress', values: [newEmailAddress] }),
                }),
            ]);
            await client.modify(searchResult.searchEntries[0].dn, [
                new Change({
                    operation: 'replace',
                    modification: new Attribute({ type: 'mailAlternativeAddress', values: [currentEmailAddress] }),
                }),
            ]);
            this.logger.info(
                `LDAP: Successfully modified mailPrimaryAddress and mailAlternativeAddress for personId:${personId}`,
            );

            this.eventService.publish(new LdapPersonEntryChangedEvent(personId, newEmailAddress, currentEmailAddress));

            return { ok: true, value: personId };
        });
    }
}
