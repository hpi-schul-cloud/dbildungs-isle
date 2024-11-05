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

export type PersonData = {
    vorname: string;
    familienname: string;
    id: string;
    referrer?: string;
    ldapEntryUUID?: string;
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

    public async createLehrer(
        person: PersonData,
        domain: string,
        mail?: string, //Wird hier erstmal seperat mit reingegeben bis die Umstellung auf primary/alternative erfolgt
    ): Promise<Result<PersonData>> {
        if (!person.referrer) {
            return {
                ok: false,
                error: new UsernameRequiredError(
                    `Lehrer ${person.vorname} ${person.familienname} does not have a username`,
                ),
            };
        }
        const rootName: Result<string> = this.getRootNameOrError(domain);
        if (!rootName.ok) return rootName;

        const lehrerUid: string = this.getLehrerUid(person.referrer, rootName.value);
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

    public async deleteLehrerByPersonId(personId: PersonID): Promise<Result<PersonID>> {
        return this.mutex.runExclusive(async () => {
            this.logger.info('LDAP: deleteLehrer');
            const client: Client = this.ldapClient.getClient();
            const bindResult: Result<boolean> = await this.bind();
            if (!bindResult.ok) return bindResult;

            const searchResultLehrer: SearchResult = await client.search(`${LdapClientService.DC_SCHULE_SH_DC_DE}`, {
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
                    filter: `(entryUUID=${personId})`,
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

            this.eventService.publish(new LdapPersonEntryChangedEvent(personId, newEmailAddress, currentEmailAddress));

            return { ok: true, value: personId };
        });
    }
}
