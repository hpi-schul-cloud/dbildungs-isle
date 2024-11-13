import { faker } from '@faker-js/faker';
import { User } from '../../src/modules/keycloak-administration/domain/user.js';
import { OrganisationsTyp, Traegerschaft } from '../../src/modules/organisation/domain/organisation.enums.js';
import {
    Jahrgangsstufe,
    Personenstatus,
    SichtfreigabeType,
} from '../../src/modules/personenkontext/domain/personenkontext.enums.js';
import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../../src/modules/rolle/domain/rolle.enums.js';
import { Rolle as RolleAggregate } from '../../src/modules/rolle/domain/rolle.js';
import { DoBase } from '../../src/shared/types/do-base.js';
import { ServiceProvider } from '../../src/modules/service-provider/domain/service-provider.js';
import {
    ServiceProviderKategorie,
    ServiceProviderSystem,
    ServiceProviderTarget,
} from '../../src/modules/service-provider/domain/service-provider.enum.js';
import { Person } from '../../src/modules/person/domain/person.js';
import { Personenkontext } from '../../src/modules/personenkontext/domain/personenkontext.js';
import { Organisation } from '../../src/modules/organisation/domain/organisation.js';
import { PersonenkontextDo } from '../../src/modules/personenkontext/domain/personenkontext.do.js';
import { ImportDataItem } from '../../src/modules/import/domain/import-data-item.js';

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
        props?: Partial<Person<WasPersisted>>,
    ): Person<WasPersisted> {
        const person: Partial<Person<WasPersisted>> = {
            keycloakUserId: faker.string.uuid(),
            mandant: faker.string.uuid(),
            familienname: faker.person.lastName(),
            vorname: faker.person.fullName(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            personalnummer: faker.string.numeric({ length: 7 }),
            revision: '1',
        };
        return Object.assign(Object.create(Person.prototype) as Person<boolean>, person, props);
    }

    public static createOrganisation<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<Organisation<false>>,
    ): Organisation<WasPersisted> {
        const organisation: Partial<Organisation<WasPersisted>> = {
            id: withId ? faker.string.uuid() : undefined,
            kennung: faker.lorem.word(),
            name: faker.company.name(),
            namensergaenzung: faker.company.name(),
            kuerzel: faker.lorem.word(),
            typ: OrganisationsTyp.SONSTIGE,
            traegerschaft: Traegerschaft.SONSTIGE,
            emailDomain: faker.internet.email(),
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
        };
        return Object.assign(Object.create(Organisation.prototype) as Organisation<boolean>, organisation, props);
    }

    public static createUser<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<User<WasPersisted>>,
    ): User<WasPersisted> {
        const user: User<false> = {
            id: withId ? faker.string.uuid() : undefined,
            createdDate: withId ? faker.date.past() : undefined,
            username: faker.internet.userName(),
            email: faker.internet.email(),
            externalSystemIDs: {},
            enabled: true,
            attributes: {},
        };

        return Object.assign(Object.create(User.prototype) as User<boolean>, user, props);
    }

    public static createPersonenkontext<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<Personenkontext<WasPersisted>>,
    ): Personenkontext<WasPersisted> {
        const pk: Partial<Personenkontext<false>> = {
            id: withId ? faker.string.uuid() : undefined,
            mandant: faker.string.uuid(),
            personId: faker.string.uuid(),
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            organisationId: faker.string.uuid(),
            revision: '1',
            rolleId: faker.string.uuid(),
            jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
            personenstatus: Personenstatus.AKTIV,
            referrer: 'referrer',
            sichtfreigabe: SichtfreigabeType.JA,
            loeschungZeitpunkt: faker.date.anytime(),
            befristung: faker.date.anytime(),
        };

        return Object.assign(Object.create(Personenkontext.prototype) as Personenkontext<boolean>, pk, props);
    }

    public static createRolle<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<RolleAggregate<WasPersisted>>,
    ): RolleAggregate<WasPersisted> {
        const rolle: Partial<RolleAggregate<WasPersisted>> = {
            name: faker.person.jobTitle(),
            administeredBySchulstrukturknoten: faker.string.uuid(),
            rollenart: faker.helpers.enumValue(RollenArt),
            merkmale: [faker.helpers.enumValue(RollenMerkmal)],
            systemrechte: [faker.helpers.enumValue(RollenSystemRecht)],
            serviceProviderIds: [],
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            serviceProviderData: [],
        };
        return Object.assign(Object.create(RolleAggregate.prototype) as RolleAggregate<boolean>, rolle, props);
    }

    public static createServiceProvider<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<ServiceProvider<WasPersisted>>,
    ): ServiceProvider<WasPersisted> {
        const serviceProvider: Partial<ServiceProvider<WasPersisted>> = {
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            name: faker.word.noun(),
            target: ServiceProviderTarget.URL,
            url: faker.internet.url(),
            kategorie: faker.helpers.enumValue(ServiceProviderKategorie),
            logoMimeType: 'image/png',
            // 1x1 black PNG
            logo: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==',
                'base64',
            ),
            providedOnSchulstrukturknoten: faker.string.uuid(),
            externalSystem: ServiceProviderSystem.NONE,
            requires2fa: true,
        };
        return Object.assign(
            Object.create(ServiceProvider.prototype) as ServiceProvider<boolean>,
            serviceProvider,
            props,
        );
    }

    /**
     * @deprecated Remove this when PersonenkontextDo is removed or set to deprecated
     */
    public static createPersonenkontextDo<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        params: Partial<PersonenkontextDo<boolean>> = {},
    ): PersonenkontextDo<WasPersisted> {
        const personenkontext: PersonenkontextDo<false> = {
            id: withId ? faker.string.uuid() : undefined,
            mandant: faker.string.uuid(),
            personId: faker.string.uuid(),
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            organisationId: faker.string.uuid(),
            revision: '1',
            rolleId: faker.string.uuid(),
            jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
            personenstatus: Personenstatus.AKTIV,
            referrer: 'referrer',
            sichtfreigabe: SichtfreigabeType.JA,
            loeschungZeitpunkt: faker.date.anytime(),
        };

        return Object.assign(new PersonenkontextDo<WasPersisted>(), personenkontext, params);
    }

    public static createOrganisationAggregate<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        params: Partial<Organisation<boolean>> = {},
    ): Organisation<WasPersisted> {
        const organisation: Organisation<WasPersisted> = Organisation.construct<boolean>(
            withId ? faker.string.uuid() : undefined,
            withId ? faker.date.past() : undefined,
            withId ? faker.date.recent() : undefined,
            params.version ?? 1,
            faker.string.uuid(),
            faker.string.uuid(),
            faker.lorem.word(),
            faker.lorem.word(),
            faker.lorem.word(),
            faker.string.uuid(),
            faker.helpers.enumValue(OrganisationsTyp),
            faker.helpers.enumValue(Traegerschaft),
        );

        Object.assign(organisation, params);

        return organisation;
    }

    public static createImportDataItem<WasPersisted extends boolean>(
        this: void,
        withId: WasPersisted,
        props?: Partial<ImportDataItem<WasPersisted>>,
    ): ImportDataItem<WasPersisted> {
        const person: Partial<ImportDataItem<WasPersisted>> = {
            importvorgangId: faker.string.uuid(),
            nachname: faker.person.lastName(),
            vorname: faker.person.fullName(),
            id: withId ? faker.string.uuid() : undefined,
            createdAt: withId ? faker.date.past() : undefined,
            updatedAt: withId ? faker.date.recent() : undefined,
            klasse: faker.lorem.word({ length: 2 }),
            personalnummer: undefined,
        };
        return Object.assign(Object.create(ImportDataItem.prototype) as ImportDataItem<boolean>, person, props);
    }
}
