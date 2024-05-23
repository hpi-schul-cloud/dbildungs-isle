import { Injectable } from '@nestjs/common';
import { ClassLogger } from '../../logging/class-logger.js';
import { Client } from 'ldapts';
import { LdapOrganisationEntry, LdapPersonEntry, LdapRoleEntry } from './ldap.types.js';
import { CreatedOrganisationDto } from '../../../modules/organisation/api/created-organisation.dto.js';
import { KennungRequiredForSchuleError } from '../../../modules/organisation/specification/error/kennung-required-for-schule.error.js';
import { Person } from '../../../modules/person/domain/person.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { LdapInstanceConfig } from '../ldap-instance-config.js';

@Injectable()
export class LdapClientService {
    private client: Client | undefined;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly ldapInstanceConfig: LdapInstanceConfig,
    ) {}

    private async getClient(): Promise<Result<Client>> {
        if (!this.client) {
            // configure LDAP connection
            const client: Client = new Client({
                url: this.ldapInstanceConfig.URL,
            });
            try {
                await client.bind(this.ldapInstanceConfig.BIND_DN, this.ldapInstanceConfig.PASSWORD);
                this.logger.info('Successfully connected to LDAP');
                this.client = client;
            } catch (err) {
                this.logger.error(`Could not connect to LDAP, message: ${JSON.stringify(err)}`);
                return { ok: false, error: new Error(`Could not connect to LDAP, message: ${JSON.stringify(err)}`) };
            }
        }
        return { ok: true, value: this.client };
    }

    public async createOrganisation(organisation: CreatedOrganisationDto): Promise<Result<CreatedOrganisationDto>> {
        const clientResult: Result<Client> = await this.getClient();
        if (!clientResult.ok) return clientResult;
        if (!organisation.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };
        const organisationEntry: LdapOrganisationEntry = {
            ou: organisation.kennung,
            objectclass: ['organizationalUnit'],
        };
        const roleEntry: LdapRoleEntry = {
            cn: 'lehrer',
            ou: organisation.kennung,
            objectclass: ['organizationalRole'],
        };
        const client: Client = clientResult.value;

        await client.add(`ou=${organisation.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`, organisationEntry);
        await client.add(`cn=lehrer,ou=${organisation.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`, roleEntry);

        this.logger.info('Successfully created organisation and corresponding lehrer rolle');

        return { ok: true, value: organisation };
    }

    public async createLehrer(person: Person<true>, organisation: Organisation<true>): Promise<Result<Person<true>>> {
        const clientResult: Result<Client> = await this.getClient();
        if (!clientResult.ok) return clientResult;
        if (!organisation.kennung) return { ok: false, error: new KennungRequiredForSchuleError() };
        const entry: LdapPersonEntry = {
            cn: person.vorname,
            sn: person.familienname,
            mail: ['testme@mail.de'],
            objectclass: ['inetOrgPerson'],
        };
        const client: Client = clientResult.value;

        await client.add(
            `uid=${person.vorname}${person.familienname},cn=lehrer,ou=${organisation.kennung},ou=oeffentlicheSchulen,dc=schule-sh,dc=de`,
            entry,
        );
        this.logger.info('Successfully created lehrer');

        return { ok: true, value: person };
    }
}
