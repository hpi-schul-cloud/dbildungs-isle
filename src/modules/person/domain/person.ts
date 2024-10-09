import { faker } from '@faker-js/faker';
import { DomainError, MismatchedRevisionError } from '../../../shared/error/index.js';
import { Geschlecht, Vertrauensstufe } from './person.enums.js';
import { UsernameGeneratorService } from './username-generator.service.js';
import { NameValidator } from '../../../shared/validation/name-validator.js';
import { VornameForPersonWithTrailingSpaceError } from './vorname-with-trailing-space.error.js';
import { FamiliennameForPersonWithTrailingSpaceError } from './familienname-with-trailing-space.error.js';
import { LockKeys } from '../../keycloak-administration/index.js';

type PasswordInternalState = { passwordInternal: string | undefined; isTemporary: boolean };
export type LockInfo = Record<LockKeys, string>;

export type PersonCreationParams = {
    familienname: string;
    vorname: string;
    referrer?: string;
    stammorganisation?: string;
    initialenFamilienname?: string;
    initialenVorname?: string;
    rufname?: string;
    nameTitel?: string;
    nameAnrede?: string[];
    namePraefix?: string[];
    nameSuffix?: string[];
    nameSortierindex?: string;
    geburtsdatum?: Date;
    geburtsort?: string;
    geschlecht?: Geschlecht;
    lokalisierung?: string;
    vertrauensstufe?: Vertrauensstufe;
    auskunftssperre?: boolean;
    username?: string;
    password?: string;
    personalnummer?: string;
    lockInfo?: LockInfo;
    isLocked?: boolean;
};

export class Person<WasPersisted extends boolean> {
    public static readonly CREATE_PERSON_DTO_MANDANT_UUID: string = '8c6a9447-c23e-4e70-8595-3bcc88a5577a';

    private passwordInternalState: PasswordInternalState = {
        passwordInternal: undefined,
        isTemporary: true,
    };

    public readonly mandant: string;

    private constructor(
        public id: Persisted<string, WasPersisted>,
        public createdAt: Persisted<Date, WasPersisted>,
        public updatedAt: Persisted<Date, WasPersisted>,
        public familienname: string,
        public vorname: string,
        public revision: string,
        public username?: string,
        public keycloakUserId?: string,
        public referrer?: string,
        public stammorganisation?: string,
        public initialenFamilienname?: string,
        public initialenVorname?: string,
        public rufname?: string,
        public nameTitel?: string,
        public nameAnrede?: string[],
        public namePraefix?: string[],
        public nameSuffix?: string[],
        public nameSortierindex?: string,
        public geburtsdatum?: Date,
        public geburtsort?: string,
        public geschlecht?: Geschlecht,
        public lokalisierung?: string,
        public vertrauensstufe?: Vertrauensstufe,
        public auskunftssperre?: boolean,
        public personalnummer?: string,
        public lockInfo?: LockInfo,
        public isLocked?: boolean,
        public email?: string,
    ) {
        this.mandant = Person.CREATE_PERSON_DTO_MANDANT_UUID;
    }

    public get newPassword(): string | undefined {
        return this.passwordInternalState?.passwordInternal ?? undefined;
    }

    public get isNewPasswordTemporary(): boolean {
        return this.passwordInternalState.isTemporary;
    }

    public static construct<WasPersisted extends boolean = false>(
        id: Persisted<string, WasPersisted>,
        createdAt: Persisted<Date, WasPersisted>,
        updatedAt: Persisted<Date, WasPersisted>,
        familienname: string,
        vorname: string,
        revision: string,
        username?: string,
        keycloakUserId?: string,
        referrer?: string,
        stammorganisation?: string,
        initialenFamilienname?: string,
        initialenVorname?: string,
        rufname?: string,
        nameTitel?: string,
        nameAnrede?: string[],
        namePraefix?: string[],
        nameSuffix?: string[],
        nameSortierindex?: string,
        geburtsdatum?: Date,
        geburtsort?: string,
        geschlecht?: Geschlecht,
        lokalisierung?: string,
        vertrauensstufe?: Vertrauensstufe,
        auskunftssperre?: boolean,
        personalnummer?: string,
        lockInfo?: LockInfo,
        isLocked?: boolean,
        email?: string,
    ): Person<WasPersisted> {
        return new Person(
            id,
            createdAt,
            updatedAt,
            familienname,
            vorname,
            revision,
            username,
            keycloakUserId,
            referrer,
            stammorganisation,
            initialenFamilienname,
            initialenVorname,
            rufname,
            nameTitel,
            nameAnrede,
            namePraefix,
            nameSuffix,
            nameSortierindex,
            geburtsdatum,
            geburtsort,
            geschlecht,
            lokalisierung,
            vertrauensstufe,
            auskunftssperre,
            personalnummer,
            lockInfo,
            isLocked,
            email,
        );
    }

    public static async createNew(
        usernameGenerator: UsernameGeneratorService,
        creationParams: PersonCreationParams,
    ): Promise<Person<false> | DomainError> {
        // Validate the Vor - and Nachname
        if (!NameValidator.isNameValid(creationParams.vorname)) {
            return new VornameForPersonWithTrailingSpaceError();
        }
        if (!NameValidator.isNameValid(creationParams.familienname)) {
            return new FamiliennameForPersonWithTrailingSpaceError();
        }
        const person: Person<false> = new Person(
            undefined,
            undefined,
            undefined,
            creationParams.familienname,
            creationParams.vorname,
            '1',
            undefined, //username
            undefined, //keycloakUserId
            creationParams.referrer,
            creationParams.stammorganisation,
            creationParams.initialenFamilienname,
            creationParams.initialenVorname,
            creationParams.rufname,
            creationParams.nameTitel,
            creationParams.nameAnrede,
            creationParams.namePraefix,
            creationParams.nameSuffix,
            creationParams.nameSortierindex,
            creationParams.geburtsdatum,
            creationParams.geburtsort,
            creationParams.geschlecht,
            creationParams.lokalisierung,
            creationParams.vertrauensstufe,
            creationParams.auskunftssperre,
            creationParams.personalnummer,
        );

        if (creationParams.password) {
            person.passwordInternalState.passwordInternal = creationParams.password;
            person.passwordInternalState.isTemporary = false;
        } else {
            person.resetPassword();
        }

        if (creationParams.username) {
            person.username = creationParams.username;
        } else {
            const result: Result<string, DomainError> = await usernameGenerator.generateUsername(
                person.vorname,
                person.familienname,
            );
            if (!result.ok) {
                return result.error;
            }
            person.username = result.value;
        }

        return person;
    }

    public update(
        revision: string,
        familienname?: string,
        vorname?: string,
        referrer?: string,
        stammorganisation?: string,
        initialenFamilienname?: string,
        initialenVorname?: string,
        rufname?: string,
        nameTitel?: string,
        nameAnrede?: string[],
        namePraefix?: string[],
        nameSuffix?: string[],
        nameSortierindex?: string,
        geburtsdatum?: Date,
        geburtsort?: string,
        geschlecht?: Geschlecht,
        lokalisierung?: string,
        vertrauensstufe?: Vertrauensstufe,
        auskunftssperre?: boolean,
        personalnummer?: string,
        lockInfo?: LockInfo,
        isLocked?: boolean,
        email?: string,
    ): void | DomainError {
        if (this.revision !== revision) {
            return new MismatchedRevisionError(
                `Revision ${revision} does not match revision ${this.revision} of stored person.`,
            );
        }
        const newRevision: string = (parseInt(this.revision) + 1).toString();

        if (vorname && !NameValidator.isNameValid(vorname)) {
            return new VornameForPersonWithTrailingSpaceError();
        }
        if (familienname && !NameValidator.isNameValid(familienname)) {
            return new FamiliennameForPersonWithTrailingSpaceError();
        }

        this.familienname = familienname ?? this.familienname;
        this.vorname = vorname ?? this.vorname;
        this.referrer = referrer;
        this.stammorganisation = stammorganisation;
        this.initialenFamilienname = initialenFamilienname;
        this.initialenVorname = initialenVorname;
        this.rufname = rufname;
        this.nameTitel = nameTitel;
        this.nameAnrede = nameAnrede;
        this.namePraefix = namePraefix;
        this.nameSuffix = nameSuffix;
        this.nameSortierindex = nameSortierindex;
        this.geburtsdatum = geburtsdatum;
        this.geburtsort = geburtsort;
        this.geschlecht = geschlecht;
        this.lokalisierung = lokalisierung;
        this.vertrauensstufe = vertrauensstufe;
        this.auskunftssperre = auskunftssperre;
        this.revision = newRevision;
        this.personalnummer = personalnummer ?? this.personalnummer;
        this.lockInfo = lockInfo;
        this.isLocked = isLocked;
        this.email = email;
    }

    public resetPassword(): void {
        this.passwordInternalState.passwordInternal = faker.string.alphanumeric({
            length: { min: 10, max: 10 },
            casing: 'mixed',
        });
    }
}
