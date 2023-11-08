import { faker } from '@faker-js/faker';
import { UserDo } from '../../src/modules/keycloak-administration/domain/user.do.js';
import { OrganisationDo } from '../../src/modules/organisation/domain/organisation.do.js';
import { OrganisationsTyp } from '../../src/modules/organisation/domain/organisation.enum.js';
import { PersonDo } from '../../src/modules/person/domain/person.do.js';
import { PersonenkontextDo } from '../../src/modules/person/domain/personenkontext.do.js';
import { Jahrgangsstufe, Personenstatus, Rolle } from '../../src/modules/person/domain/personenkontext.enums.js';
import { PersonRollenZuweisungDo } from '../../src/modules/rolle/domain/person-rollen-zuweisung.do.js';
import { RolleBerechtigungsZuweisungDo } from '../../src/modules/rolle/domain/rolle-berechtigungs-zuweisung.do.js';
import { RolleRechtDo } from '../../src/modules/rolle/domain/rolle-recht.do.js';
import { RolleDo } from '../../src/modules/rolle/domain/rolle.do.js';
import { ServiceProviderZugriffDo } from '../../src/modules/rolle/domain/service-provider-zugriff.do.js';
import { ServiceProviderDo } from '../../src/modules/rolle/domain/service-provider.do.js';
import { DoBase } from '../../src/shared/types/do-base.js';

export class DoFactory {
    public static createMany<T extends DoBase<boolean>>(
        this: void,
        n: number,
        withId: T extends DoBase<true> ? true : false,
        generate: (withId: T extends DoBase<true> ? true : false, props?: Partial<T>) => T,
        props?: Partial<T>,
    ): T[] {
        return Array.from({ length: n }, (_v: unknown, _k: number) => generate(withId, props));
    }

    public static createPerson<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<PersonDo<false>>,
    ): PersonDo<WasPersisted> {
        const person: PersonDo<false> = {
            keycloakUserId: faker.string.uuid(),
            mandant: faker.string.uuid(),
            familienname: faker.person.lastName(),
            vorname: faker.person.fullName(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new PersonDo<WasPersisted>(), person, props);
    }

    public static createOrganisation<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<OrganisationDo<false>>,
    ): OrganisationDo<WasPersisted> {
        const organisation: OrganisationDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            kennung: faker.lorem.word(),
            name: faker.company.name(),
            namensergaenzung: faker.company.name(),
            kuerzel: faker.lorem.word(),
            typ: OrganisationsTyp.SONSTIGE,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new OrganisationDo<WasPersisted>(), organisation, props);
    }

    public static createUser<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<UserDo<WasPersisted>>,
    ): UserDo<WasPersisted> {
        const user: UserDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            createdDate: withId ? faker.date.past() : undefined,
            username: faker.internet.userName(),
            email: faker.internet.email(),
        };

        return Object.assign(new UserDo<WasPersisted>(), user, props);
    }

    public static createPersonenkontext<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<PersonenkontextDo<WasPersisted>>,
    ): PersonenkontextDo<WasPersisted> {
        const user: PersonenkontextDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            mandant: faker.string.uuid(),
            personId: faker.string.uuid(),
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            organisation: DoFactory.createOrganisation(true),
            revision: '1',
            rolle: Rolle.LEHRENDER,
            jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
            personenstatus: Personenstatus.AKTIV,
            referrer: 'referrer',
            sichtfreigabe: true,
            loeschungZeitpunkt: faker.date.anytime(),
        };

        return Object.assign(new PersonenkontextDo<WasPersisted>(), user, props);
    }

    public static createServiceProvider<WasPersisted extends boolean>(
        withId: WasPersisted,
        props?: Partial<ServiceProviderDo<WasPersisted>>,
    ): ServiceProviderDo<WasPersisted> {
        const serviceProvider: ServiceProviderDo<false> = {
            name: faker.internet.domainWord(),
            url: faker.internet.url(),
            providedOnSchulstrukturknoten: faker.string.numeric(),
            id: withId ? faker.string.numeric() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new ServiceProviderDo<WasPersisted>(), serviceProvider, props);
    }

    public static createServiceProviderZugriff<WasPersisted extends boolean>(
        withId: WasPersisted,
        props?: Partial<ServiceProviderZugriffDo<WasPersisted>>,
    ): ServiceProviderZugriffDo<WasPersisted> {
        const serviceProviderZugriff: ServiceProviderZugriffDo<false> = {
            serviceProvider: faker.lorem.word(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new ServiceProviderZugriffDo<WasPersisted>(), serviceProviderZugriff, props);
    }

    public static createRolle<WasPersisted extends boolean>(
        withId: WasPersisted,
        props?: Partial<RolleDo<WasPersisted>>,
    ): RolleDo<WasPersisted> {
        const rolle: RolleDo<false> = {
            administeredBySchulstrukturknoten: faker.string.numeric(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new RolleDo<WasPersisted>(), rolle, props);
    }

    public static createRolleRecht<WasPersisted extends boolean>(
        withId: WasPersisted,
        props?: Partial<RolleRechtDo<WasPersisted>>,
    ): RolleRechtDo<WasPersisted> {
        const rolleRecht: RolleRechtDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new RolleRechtDo<WasPersisted>(), rolleRecht, props);
    }

    public static createPersonRollenZuweisung<WasPersisted extends boolean>(
        personId: string,
        rolle: RolleDo<boolean>,
        withId: WasPersisted,
        props?: Partial<PersonRollenZuweisungDo<WasPersisted>>,
    ): PersonRollenZuweisungDo<WasPersisted> {
        const personRollenZuweisung: PersonRollenZuweisungDo<false> = {
            person: personId,
            rolle: rolle,
            schulstrukturknoten: faker.string.numeric(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new PersonRollenZuweisungDo<WasPersisted>(), personRollenZuweisung, props);
    }

    public static createRolleBerechtigungsZuweisung<WasPersisted extends boolean>(
        rolle: RolleDo<boolean>,
        rolleRecht: RolleRechtDo<boolean>,
        withId: WasPersisted,
        props?: Partial<RolleBerechtigungsZuweisungDo<WasPersisted>>,
    ): RolleBerechtigungsZuweisungDo<WasPersisted> {
        const rolleBerechtigungsZuweisung: RolleBerechtigungsZuweisungDo<false> = {
            rolle: rolle,
            rolleRecht: rolleRecht,
            validForAdministrativeParents: false,
            validForOrganisationalChildren: false,
            schulstrukturknoten: faker.string.numeric(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(new RolleBerechtigungsZuweisungDo<WasPersisted>(), rolleBerechtigungsZuweisung, props);
    }
}
