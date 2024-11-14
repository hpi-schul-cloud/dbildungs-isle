import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../logging/class-logger.js';
import { Attribute, Change, Client, Control, SearchResult } from 'ldapts';
import { LdapEntityType, LdapPersonEntry } from './ldap.types.js';
import { LdapClient } from './ldap-client.js';
import { LdapInstanceConfig } from '../ldap-instance-config.js';
import { UsernameRequiredError } from '../../../modules/person/domain/username-required.error.js';
import { Mutex } from 'async-mutex';
import { LdapSearchError } from '../error/ldap-search.error.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { EventService } from '../../eventbus/services/event.service.js';
import { LdapPersonEntryChangedEvent } from '../../../shared/events/ldap-person-entry-changed.event.js';
import { LdapEmailAddressError } from '../error/ldap-email-address.error.js';
import { LdapEmailDomainError } from '../error/ldap-email-domain.error.js';
import { LdapCreateLehrerError } from '../error/ldap-create-lehrer.error.js';
import { LdapModifyEmailError } from '../error/ldap-modify-email.error.js';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { Person } from '../../../modules/person/domain/person.js';

export type PersonData = {
    vorname: string;
    familienname: string;
    id: string;
    referrer?: string;
    ldapEntryUUID?: string; // When this field is set, it will use the relax operator. Only use during migration.
};

@Injectable()
export class LdapClientService {
    public static readonly OEFFENTLICHE_SCHULEN_DOMAIN: string = 'schule-sh.de';

    public static readonly ERSATZ_SCHULEN_DOMAIN: string = 'ersatzschule-sh.de';

    public static readonly OEFFENTLICHE_SCHULEN_OU: string = 'oeffentlicheSchulen';

    public static readonly ERSATZ_SCHULEN_OU: string = 'ersatzSchulen';

    public static readonly MAIL_PRIMARY_ADDRESS: string = 'mailPrimaryAddress';

    public static readonly MAIL_ALTERNATIVE_ADDRESS: string = 'mailAlternativeAddress';

    public static readonly DC_SCHULE_SH_DC_DE: string = 'dc=schule-sh,dc=de';

    public static readonly GID_NUMBER: string = '100'; //because 0 to 99 are used for statically allocated user groups on Unix-systems

    public static readonly UID_NUMBER: string = '100'; //to match the GID_NUMBER rule above and 0 is reserved for super-user

    public static readonly HOME_DIRECTORY: string = 'none'; //highlight it's a dummy value

    private static readonly RELAX_OID: string = '1.3.6.1.4.1.4203.666.5.12'; // Relax Control

    private mutex: Mutex;

    public constructor(
        private readonly ldapClient: LdapClient,
        private readonly ldapInstanceConfig: LdapInstanceConfig,
        private readonly logger: ClassLogger,
        private readonly eventService: EventService,
        private readonly personRepo: PersonRepository,
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

    private getRootName(emailDomain: string): Result<string, LdapEmailDomainError> {
        if (emailDomain === LdapClientService.ERSATZ_SCHULEN_DOMAIN)
            return {
                ok: true,
                value: LdapClientService.ERSATZ_SCHULEN_OU,
            };
        if (emailDomain === LdapClientService.OEFFENTLICHE_SCHULEN_DOMAIN)
            return {
                ok: true,
                value: LdapClientService.OEFFENTLICHE_SCHULEN_OU,
            };

        return {
            ok: false,
            error: new LdapEmailDomainError(),
        };
    }

    private getLehrerUid(referrer: string, rootName: string): string {
        return `uid=${referrer},ou=${rootName},${LdapClientService.DC_SCHULE_SH_DC_DE}`;
    }

    private getRootNameOrError(domain: string): Result<string> {
        const rootName: Result<string> = this.getRootName(domain);
        if (!rootName.ok) {
            this.logger.error(`Could not get root-name because email-domain is invalid, domain:${domain}`);
        }
        return rootName;
    }

    private async getPersonReferrerOrUndefined(personId: PersonID): Promise<string | undefined> {
        const person: Option<Person<true>> = await this.personRepo.findById(personId);

        return person?.referrer;
    }

    public async createLehrer(
        person: PersonData,
        domain: string,
        mail?: string, //Wird hier erstmal seperat mit reingegeben bis die Umstellung auf primary/alternative erfolgt
    ): Promise<Result<PersonData>> {
        const referrer: string | undefined = person.referrer;
        if (!referrer) {
            return {
                ok: false,
                error: new UsernameRequiredError(
                    `Lehrer ${person.vorname} ${person.familienname} does not have a username`,
                ),
            };
        }
        const rootName: Result<string> = this.getRootNameOrError(domain);
        if (!rootName.ok) return rootName;

        const lehrerUid: string = this.getLehrerUid(referrer, rootName.value);
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: createLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(
                `ou=${rootName.value},${LdapClientService.DC_SCHULE_SH_DC_DE}`,
                {
                    filter: `(uid=${person.referrer})`,
                },
            );
            if (searchResultLehrer.searchEntries.length > 0) {
                this.logger.info(`LDAP: Lehrer ${lehrerUid} exists, nothing to create`);

                return { ok: true, value: person };
            }
            const entry: LdapPersonEntry = {
                uid: referrer,
                uidNumber: LdapClientService.UID_NUMBER,
                gidNumber: LdapClientService.GID_NUMBER,
                homeDirectory: LdapClientService.HOME_DIRECTORY,
                cn: referrer,
                givenName: person.vorname,
                sn: person.familienname,
                objectclass: ['inetOrgPerson', 'univentionMail', 'posixAccount'],
                mailPrimaryAddress: mail ?? ``,
                mailAlternativeAddress: mail ?? ``,
            };

            const controls: Control[] = [];
            if (person.ldapEntryUUID) {
                entry.entryUUID = person.ldapEntryUUID;
                controls.push(new Control(LdapClientService.RELAX_OID));
            }

            try {
                await client.add(lehrerUid, entry, controls);
                this.logger.info(`LDAP: Successfully created lehrer ${lehrerUid}`);

                return { ok: true, value: person };
            } catch (err) {
                const errMsg: string = JSON.stringify(err);
                this.logger.error(`LDAP: Creating lehrer FAILED, uid:${lehrerUid}, errMsg:${errMsg}`);

                return { ok: false, error: new LdapCreateLehrerError() };
            }
        });
    }

    public async isLehrerExisting(referrer: string, domain: string): Promise<Result<boolean>> {
        const rootName: Result<string> = this.getRootNameOrError(domain);
        if (!rootName.ok) return rootName;

        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: isLehrerExisting');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(
                `ou=${rootName.value},${LdapClientService.DC_SCHULE_SH_DC_DE}`,
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

    public async modifyPersonAttributes(
        oldReferrer: string,
        newGivenName?: string,
        newSn?: string,
        newUid?: string,
    ): Promise<Result<string>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: modifyPersonAttributes');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResult: SearchResult = await client.search(`${LdapClientService.DC_SCHULE_SH_DC_DE}`, {
                scope: 'sub',
                filter: `(uid=${oldReferrer})`,
                attributes: ['givenName', 'sn', 'uid'],
                returnAttributeValues: true,
            });
            if (!searchResult.searchEntries[0]) {
                this.logger.error(`Modification FAILED, no entry for person:${oldReferrer}`);
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }

            const entryDn: string = searchResult.searchEntries[0].dn;
            const modifications: Change[] = [];

            if (newUid) {
                modifications.push(
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({
                            type: 'cn',
                            values: [newUid],
                        }),
                    }),
                );
            }
            if (newGivenName) {
                modifications.push(
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({
                            type: 'givenName',
                            values: [newGivenName],
                        }),
                    }),
                );
            }
            if (newSn) {
                modifications.push(
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({
                            type: 'sn',
                            values: [newSn],
                        }),
                    }),
                );
            }
            if (modifications.length > 0) {
                await client.modify(entryDn, modifications);
                this.logger.info(`LDAP: Successfully modified givenName/sn attributes for person:${oldReferrer}`);
            } else {
                this.logger.info(`No givenName/sn attributes provided to modify for person:${oldReferrer}`);
            }

            if (newUid && searchResult.searchEntries[0]['uid'] !== newUid) {
                const newDn: string = `uid=${newUid}`;
                await client.modifyDN(entryDn, newDn);
                this.logger.info(`LDAP: Successfully updated uid for person:${oldReferrer} to ${newUid}`);
            }

            return { ok: true, value: oldReferrer };
        });
    }

    public async deleteLehrerByReferrer(referrer: string): Promise<Result<string>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(`${LdapClientService.DC_SCHULE_SH_DC_DE}`, {
                scope: 'sub',
                filter: `(uid=${referrer})`,
            });
            if (!searchResultLehrer.searchEntries[0]) {
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }
            await client.del(searchResultLehrer.searchEntries[0].dn);
            this.logger.info(`LDAP: Successfully deleted lehrer by person:${referrer}`);

            return { ok: true, value: referrer };
        });
    }

    public async deleteLehrer(person: PersonData, domain: string): Promise<Result<PersonData>> {
        const rootName: Result<string> = this.getRootNameOrError(domain);
        if (!rootName.ok) return rootName;

        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;
            if (!person.referrer) {
                return {
                    ok: false,
                    error: new UsernameRequiredError(
                        `Lehrer ${person.vorname} ${person.familienname} does not have a username`,
                    ),
                };
            }
            const lehrerUid: string = this.getLehrerUid(person.referrer, rootName.value);
            await client.del(lehrerUid);
            this.logger.info(`LDAP: Successfully deleted lehrer ${lehrerUid}`);

            return { ok: true, value: person };
        });
    }

    public async changeEmailAddressByPersonId(personId: PersonID, newEmailAddress: string): Promise<Result<PersonID>> {
        const referrer: string | undefined = await this.getPersonReferrerOrUndefined(personId);
        if (!referrer) {
            this.logger.error(
                `Changing email-address in LDAP FAILED, no person/referrer found for personId:${personId}`,
            );
            return {
                ok: false,
                error: new LdapSearchError(LdapEntityType.LEHRER),
            };
        }

        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: changeEmailAddress');
            const splitted: string[] = newEmailAddress.split('@');
            if (!splitted || !splitted[1]) {
                this.logger.error(`LDAP: Invalid email-address:${newEmailAddress}`);

                return {
                    ok: false,
                    error: new LdapEmailAddressError(),
                };
            }
            const domain: string = splitted[1];
            const rootName: Result<string> = this.getRootNameOrError(domain);
            if (!rootName.ok) return rootName;
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;
            const searchResult: SearchResult = await client.search(
                `ou=${rootName.value},${LdapClientService.DC_SCHULE_SH_DC_DE}`,
                {
                    scope: 'sub',
                    filter: `(uid=${referrer})`,
                    attributes: [LdapClientService.MAIL_PRIMARY_ADDRESS, LdapClientService.MAIL_ALTERNATIVE_ADDRESS],
                    returnAttributeValues: true,
                },
            );
            if (!searchResult.searchEntries[0]) {
                this.logger.error(`Changing email-address in LDAP FAILED, no entry for personId:${personId}`);
                return {
                    ok: false,
                    error: new LdapSearchError(LdapEntityType.LEHRER),
                };
            }
            // result can be a simple string or a string-array
            let currentEmailAddressString: string | undefined;
            const currentLDAPEmailAddressString: unknown =
                searchResult.searchEntries[0][LdapClientService.MAIL_PRIMARY_ADDRESS];
            if (typeof currentLDAPEmailAddressString === 'string') {
                currentEmailAddressString = currentLDAPEmailAddressString;
            }
            if (Array.isArray(currentLDAPEmailAddressString) && typeof currentLDAPEmailAddressString[0] === 'string') {
                currentEmailAddressString = currentLDAPEmailAddressString[0];
            }
            const currentEmailAddress: string = currentEmailAddressString ?? newEmailAddress;

            try {
                await client.modify(searchResult.searchEntries[0].dn, [
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({
                            type: LdapClientService.MAIL_PRIMARY_ADDRESS,
                            values: [newEmailAddress],
                        }),
                    }),
                ]);
                await client.modify(searchResult.searchEntries[0].dn, [
                    new Change({
                        operation: 'replace',
                        modification: new Attribute({
                            type: LdapClientService.MAIL_ALTERNATIVE_ADDRESS,
                            values: [currentEmailAddress],
                        }),
                    }),
                ]);
                this.logger.info(
                    `LDAP: Successfully modified mailPrimaryAddress and mailAlternativeAddress for personId:${personId}`,
                );
                this.eventService.publish(
                    new LdapPersonEntryChangedEvent(personId, newEmailAddress, currentEmailAddress),
                );

                return { ok: true, value: personId };
            } catch (err) {
                const errMsg: string = JSON.stringify(err);
                this.logger.error(
                    `LDAP: Modifying mailPrimaryAddress and mailAlternativeAddress FAILED, errMsg:${errMsg}`,
                );

                return { ok: false, error: new LdapModifyEmailError() };
            }
        });
    }
}
