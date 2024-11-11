import { DomainError, MismatchedRevisionError } from '../../../shared/error/index.js';
import { Geschlecht, Vertrauensstufe } from './person.enums.js';
import { UsernameGeneratorService } from './username-generator.service.js';
import { NameValidator } from '../../../shared/validation/name-validator.js';
import { VornameForPersonWithTrailingSpaceError } from './vorname-with-trailing-space.error.js';
import { FamiliennameForPersonWithTrailingSpaceError } from './familienname-with-trailing-space.error.js';
import { PersonalNummerForPersonWithTrailingSpaceError } from './personalnummer-with-trailing-space.error.js';
import { UserLock } from '../../keycloak-administration/domain/user-lock.js';
import { generatePassword } from '../../../shared/util/password-generator.js';

type PasswordInternalState = { passwordInternal: string | undefined; isTemporary: boolean };

export type PersonCreationParams = {
    id?: number;
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
    userLock?: UserLock[];
    isLocked?: boolean;
    orgUnassignmentDate?: Date;
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
        public username: string | undefined,
        public keycloakUserId: string | undefined,
        public referrer: string | undefined,
        public stammorganisation: string | undefined,
        public initialenFamilienname: string | undefined,
        public initialenVorname: string | undefined,
        public rufname: string | undefined,
        public nameTitel: string | undefined,
        public nameAnrede: string[] | undefined,
        public namePraefix: string[] | undefined,
        public nameSuffix: string[] | undefined,
        public nameSortierindex: string | undefined,
        public geburtsdatum: Date | undefined,
        public geburtsort: string | undefined,
        public geschlecht: Geschlecht | undefined,
        public lokalisierung: string | undefined,
        public vertrauensstufe: Vertrauensstufe | undefined,
        public auskunftssperre: boolean | undefined,
        public personalnummer: string | undefined,
        public userLock: UserLock[],
        public orgUnassignmentDate: Date | undefined,
        public isLocked: boolean | undefined,
        public email: string | undefined,
        public oxUserId: string | undefined,
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
        orgUnassignmentDate?: Date,
        userLock: UserLock[] = [],
        isLocked?: boolean,
        email?: string,
        oxUserId?: string,
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
            userLock,
            orgUnassignmentDate,
            isLocked,
            email,
            oxUserId,
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
        if (creationParams.personalnummer && !NameValidator.isNameValid(creationParams.personalnummer)) {
            return new PersonalNummerForPersonWithTrailingSpaceError();
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
            creationParams.userLock ?? [],
            creationParams.orgUnassignmentDate,
            undefined,
            undefined,
            undefined,
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
        userLock?: UserLock[],
        orgUnassignmentDate?: Date,
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

        if (personalnummer && !NameValidator.isNameValid(personalnummer)) {
            return new PersonalNummerForPersonWithTrailingSpaceError();
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
        this.orgUnassignmentDate = orgUnassignmentDate;
        this.isLocked = isLocked;
        this.email = email;
        this.userLock = userLock ?? [];
    }

    public resetPassword(): void {
        this.passwordInternalState.passwordInternal = generatePassword();
    }
}
