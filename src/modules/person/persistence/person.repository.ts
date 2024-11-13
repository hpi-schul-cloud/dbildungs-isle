import { randomUUID } from 'node:crypto';
import { EntityManager, FilterQuery, Loaded, QBFilterQuery, RequiredEntityData } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataConfig } from '../../../shared/config/data.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import {
    DomainError,
    EntityCouldNotBeCreated,
    EntityCouldNotBeDeleted,
    EntityNotFoundError,
    MissingPermissionsError,
} from '../../../shared/error/index.js';
import { ScopeOperator, ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PermittedOrgas, PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { KeycloakUserService, PersonHasNoKeycloakId, User } from '../../keycloak-administration/index.js';
import { RollenMerkmal, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Person } from '../domain/person.js';
import { PersonEntity } from './person.entity.js';
import { PersonScope } from './person.scope.js';
import { EventService } from '../../../core/eventbus/index.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';
import { UserLockRepository } from '../../keycloak-administration/repository/user-lock.repository.js';
import { PersonLockOccasion, SortFieldPersonFrontend } from '../domain/person.enums.js';
import { PersonUpdateOutdatedError } from '../domain/update-outdated.error.js';
import { UsernameGeneratorService } from '../domain/username-generator.service.js';
import { PersonalnummerRequiredError } from '../domain/personalnummer-required.error.js';
import { toDIN91379SearchForm } from '../../../shared/util/din-91379-validation.js';
import { NameValidator } from '../../../shared/validation/name-validator.js';
import { FamiliennameForPersonWithTrailingSpaceError } from '../domain/familienname-with-trailing-space.error.js';
import { PersonalNummerForPersonWithTrailingSpaceError } from '../domain/personalnummer-with-trailing-space.error.js';
import { VornameForPersonWithTrailingSpaceError } from '../domain/vorname-with-trailing-space.error.js';
import { PrivacyIdeaConfig } from '../../../shared/config/privacyidea.config.js';
import { UserLock } from '../../keycloak-administration/domain/user-lock.js';

/**
 * Return email-address for person, if an enabled email-address exists, return it.
 * If no enabled email-address exists, return the latest changed one (updatedAt), order is done on PersonEntity.
 * @param entity
 */
export function getEnabledOrAlternativeEmailAddress(entity: PersonEntity): string | undefined {
    for (const emailAddress of entity.emailAddresses) {
        // Email-Repo is responsible to avoid persisting multiple enabled email-addresses for same user
        if (emailAddress.status === EmailAddressStatus.ENABLED) return emailAddress.address;
    }
    return entity.emailAddresses[0] ? entity.emailAddresses[0].address : undefined;
}

export function getOxUserId(entity: PersonEntity): string | undefined {
    for (const emailAddress of entity.emailAddresses) {
        if (emailAddress.status !== EmailAddressStatus.FAILED) return emailAddress.oxUserId;
    }
    return undefined;
}

export function mapAggregateToData(person: Person<boolean>): RequiredEntityData<PersonEntity> {
    return {
        keycloakUserId: person.keycloakUserId!,
        referrer: person.referrer,
        mandant: person.mandant,
        stammorganisation: person.stammorganisation,
        familienname: person.familienname,
        vorname: person.vorname,
        initialenFamilienname: person.initialenFamilienname,
        initialenVorname: person.initialenVorname,
        rufname: person.rufname,
        nameTitel: person.nameTitel,
        nameAnrede: person.nameAnrede,
        namePraefix: person.namePraefix,
        nameSuffix: person.nameSuffix,
        nameSortierindex: person.nameSortierindex,
        geburtsdatum: person.geburtsdatum,
        geburtsort: person.geburtsort,
        geschlecht: person.geschlecht,
        lokalisierung: person.lokalisierung,
        vertrauensstufe: person.vertrauensstufe,
        auskunftssperre: person.auskunftssperre,
        dataProvider: undefined,
        revision: person.revision,
        personalnummer: person.personalnummer,
        orgUnassignmentDate: person.orgUnassignmentDate,
    };
}

export function mapEntityToAggregate(entity: PersonEntity): Person<true> {
    return Person.construct(
        entity.id,
        entity.createdAt,
        entity.updatedAt,
        entity.familienname,
        entity.vorname,
        entity.revision,
        undefined,
        entity.keycloakUserId,
        entity.referrer,
        entity.stammorganisation,
        entity.initialenFamilienname,
        entity.initialenVorname,
        entity.rufname,
        entity.nameTitel,
        entity.nameAnrede,
        entity.namePraefix,
        entity.nameSuffix,
        entity.nameSortierindex,
        entity.geburtsdatum,
        entity.geburtsort,
        entity.geschlecht,
        entity.lokalisierung,
        entity.vertrauensstufe,
        entity.auskunftssperre,
        entity.personalnummer,
        entity.orgUnassignmentDate,
        undefined,
        undefined,
        getEnabledOrAlternativeEmailAddress(entity),
        getOxUserId(entity),
    );
}

export function mapEntityToAggregateInplace(entity: PersonEntity, person: Person<boolean>): Person<true> {
    person.id = entity.id;
    person.createdAt = entity.createdAt;
    person.updatedAt = entity.updatedAt;

    return person;
}

export type PersonEventPayload = {
    personenkontexte: [{ id: string; organisationId: string; rolleId: string }];
};
export type PersonenQueryParams = {
    vorname?: string;
    familienname?: string;
    organisationIDs?: string[];
    rolleIDs?: string[];
    offset?: number;
    limit?: number;
    sortField?: SortFieldPersonFrontend;
    sortOrder?: ScopeOrder;
    suchFilter?: string;
};

@Injectable()
export class PersonRepository {
    public readonly ROOT_ORGANISATION_ID: string;

    public readonly PRIVACYIDEA_RENAME_WAITING_TIME_IN_SECONDS: number;

    public constructor(
        private readonly kcUserService: KeycloakUserService,
        private readonly userLockRepository: UserLockRepository,
        private readonly em: EntityManager,
        private readonly eventService: EventService,
        private usernameGenerator: UsernameGeneratorService,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
        this.PRIVACYIDEA_RENAME_WAITING_TIME_IN_SECONDS =
            config.getOrThrow<PrivacyIdeaConfig>('PRIVACYIDEA').RENAME_WAITING_TIME_IN_SECONDS;
    }

    private async getPersonScopeWithPermissions(
        permissions: PersonPermissions,
        requiredRights: RollenSystemRecht[],
    ): Promise<PersonScope> {
        // Find all organisations where user has the required permission
        const permittedOrgas: PermittedOrgas = await permissions.getOrgIdsWithSystemrecht(requiredRights, true);

        // Check if user has permission on root organisation
        if (permittedOrgas.all) {
            return new PersonScope();
        }
        return new PersonScope()
            .findBy({ organisationen: permittedOrgas.orgaIds })
            .setScopeWhereOperator(ScopeOperator.AND);
    }

    public async findBy(scope: PersonScope): Promise<Counted<Person<true>>> {
        const [entities, total]: Counted<PersonEntity> = await scope.executeQuery(this.em);
        const persons: Person<true>[] = entities.map((entity: PersonEntity) => mapEntityToAggregate(entity));

        return [persons, total];
    }

    public async findById(id: string): Promise<Option<Person<true>>> {
        const person: Option<PersonEntity> = await this.em.findOne(PersonEntity, { id });
        if (person) {
            return mapEntityToAggregate(person);
        }

        return null;
    }

    // When implementing this on 30.09 we are still using 'referrer', but since we want in the future to use 'username' i already did this here
    public async findByUsername(username: string): Promise<Option<Person<true>>> {
        const person: Option<PersonEntity> = await this.em.findOne(PersonEntity, { referrer: username });
        if (person) {
            return mapEntityToAggregate(person);
        }

        return null;
    }

    public async findByIds(ids: string[], permissions: PersonPermissions): Promise<Person<true>[]> {
        const permittedOrgas: PermittedOrgas = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        if (!permittedOrgas.all && !permittedOrgas.orgaIds.length) {
            return [];
        }

        let organisationWhereClause: FilterQuery<PersonEntity> = {};
        if (!permittedOrgas.all) {
            organisationWhereClause = {
                personenKontexte: { $some: { organisationId: { $in: permittedOrgas.orgaIds } } },
            };
        }

        const personEntities: PersonEntity[] = await this.em.find(PersonEntity, {
            $and: [{ id: { $in: ids } }, organisationWhereClause],
        });

        return personEntities.map((entity: PersonEntity) => mapEntityToAggregate(entity));
    }

    public async getPersonIfAllowed(
        personId: string,
        permissions: PersonPermissions,
        requiredRights: RollenSystemRecht[] = [RollenSystemRecht.PERSONEN_VERWALTEN],
    ): Promise<Result<Person<true>>> {
        const scope: PersonScope = await this.getPersonScopeWithPermissions(permissions, requiredRights);
        scope.findBy({ ids: [personId] }).sortBy('vorname', ScopeOrder.ASC);

        const [persons]: Counted<Person<true>> = await this.findBy(scope);
        let person: Person<true> | undefined = persons[0];
        if (!person) return { ok: false, error: new EntityNotFoundError('Person') };
        person = await this.extendPersonWithKeycloakData(person);

        return { ok: true, value: person };
    }

    public async extendPersonWithKeycloakData(person: Person<true>): Promise<Person<true>> {
        if (!person.keycloakUserId) {
            return person;
        }
        const keyCloakUserDataResponse: Result<User<true>, DomainError> = await this.kcUserService.findById(
            person.keycloakUserId,
        );
        person.isLocked = false;
        if (!keyCloakUserDataResponse.ok) {
            return person;
        }
        person.userLock = await this.userLockRepository.findByPersonId(person.id);
        person.isLocked = keyCloakUserDataResponse.value.enabled === false;
        return person;
    }

    private async checkIfDeleteIsAllowed(
        personId: string,
        permissions: PersonPermissions,
    ): Promise<Result<Person<true>>> {
        // Check if the user has permission to delete immediately
        const scope: PersonScope = await this.getPersonScopeWithPermissions(permissions, [
            RollenSystemRecht.PERSONEN_SOFORT_LOESCHEN,
        ]);
        scope.findBy({ ids: [personId] }).sortBy('vorname', ScopeOrder.ASC);

        const [persons]: Counted<Person<true>> = await this.findBy(scope);
        const person: Person<true> | undefined = persons[0];

        if (!person) {
            return { ok: false, error: new EntityCouldNotBeDeleted('Person', personId) };
        }

        return { ok: true, value: person };
    }

    public async deletePerson(
        personId: string,
        permissions: PersonPermissions,
        removedPersonenkontexts: PersonenkontextEventKontextData[],
    ): Promise<Result<void, DomainError>> {
        // First check if the user has permission to view the person
        const personResult: Result<Person<true>> = await this.getPersonIfAllowed(personId, permissions);

        if (!personResult.ok) {
            return { ok: false, error: new EntityNotFoundError('Person') };
        }

        // Now check if the user has the permission to delete immediately
        const deletePermissionResult: Result<Person<true>> = await this.checkIfDeleteIsAllowed(personId, permissions);

        if (!deletePermissionResult.ok) {
            return { ok: false, error: new EntityCouldNotBeDeleted('Person', personId) };
        }

        const person: Person<true> = deletePermissionResult.value;

        // Check if the person has a keycloakUserId
        if (!person.keycloakUserId) {
            throw new PersonHasNoKeycloakId(person.id);
        }

        // Delete the person from Keycloak
        await this.kcUserService.delete(person.keycloakUserId);

        const personenkontextUpdatedEvent: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
            {
                id: personId,
                familienname: person.familienname,
                vorname: person.vorname,
                email: person.email,
            },
            [],
            removedPersonenkontexts,
            [],
        );
        this.eventService.publish(personenkontextUpdatedEvent);

        if (person.referrer !== undefined) {
            this.eventService.publish(new PersonDeletedEvent(personId, person.referrer, person.email));
        }

        // Delete the person from the database with all their kontexte
        await this.em.nativeDelete(PersonEntity, person.id);

        return { ok: true, value: undefined };
    }

    public async findByKeycloakUserId(keycloakUserId: string): Promise<Option<Person<true>>> {
        const person: Option<PersonEntity> = await this.em.findOne(PersonEntity, { keycloakUserId });
        if (person) {
            return mapEntityToAggregate(person);
        }

        return null;
    }

    public async exists(id: PersonID): Promise<boolean> {
        const person: Option<Loaded<PersonEntity, never, 'id', never>> = await this.em.findOne(
            PersonEntity,
            { id },
            { fields: ['id'] as const },
        );

        return !!person;
    }

    public async create(
        person: Person<false>,
        hashedPassword?: string,
        personId?: string,
        technicalUser: boolean = false,
    ): Promise<Person<true> | DomainError> {
        const transaction: EntityManager = this.em.fork();
        await transaction.begin();

        try {
            if (person.personalnummer) {
                // Check if personalnummer already exists
                const existingPerson: Loaded<PersonEntity, never, '*', never> | null = await transaction.findOne(
                    PersonEntity,
                    { personalnummer: person.personalnummer },
                );
                if (existingPerson) {
                    await transaction.rollback();
                    return new DuplicatePersonalnummerError(`Personalnummer ${person.personalnummer} already exists.`);
                }
            }

            // Create DB person
            const personEntity: PersonEntity = transaction.create(PersonEntity, mapAggregateToData(person)).assign({
                id: personId ?? randomUUID(), // Generate ID here instead of at insert-time
            });
            transaction.persist(personEntity);

            const persistedPerson: Person<true> = mapEntityToAggregateInplace(personEntity, person);

            // Take ID from person to create keycloak user
            let personWithKeycloakUser: Person<true> | DomainError;

            if (!technicalUser) {
                if (!hashedPassword) {
                    personWithKeycloakUser = await this.createKeycloakUser(persistedPerson, this.kcUserService);
                } else {
                    personWithKeycloakUser = await this.createKeycloakUserWithHashedPassword(
                        persistedPerson,
                        hashedPassword,
                        this.kcUserService,
                    );
                }
            } else {
                personWithKeycloakUser = persistedPerson;
            }

            // -> When keycloak fails, rollback
            if (personWithKeycloakUser instanceof DomainError) {
                await transaction.rollback();
                return personWithKeycloakUser;
            }

            // Take ID from keycloak and update user
            personEntity.assign(mapAggregateToData(personWithKeycloakUser));

            // Commit
            await transaction.commit();

            // Return mapped person
            return mapEntityToAggregateInplace(personEntity, personWithKeycloakUser);
        } catch (e) {
            // Any other errors
            // -> rollback and rethrow
            await transaction.rollback();
            throw e;
        }
    }

    public getReferrer(personEntity: Loaded<PersonEntity>): string | undefined {
        return personEntity.referrer;
    }

    public async update(person: Person<true>): Promise<Person<true> | DomainError> {
        let oldReferrer: string | undefined = '';
        const personEntity: Loaded<PersonEntity> = await this.em.findOneOrFail(PersonEntity, person.id);
        const isPersonRenamedEventNecessary: boolean = this.hasChangedNames(personEntity, person);
        if (person.newPassword) {
            const setPasswordResult: Result<string, DomainError> = await this.kcUserService.setPassword(
                person.keycloakUserId!,
                person.newPassword,
                person.isNewPasswordTemporary,
            );
            if (!setPasswordResult.ok) {
                return setPasswordResult.error;
            }
        }

        //save old referrer for person-renamed-event before updating the person
        if (isPersonRenamedEventNecessary) {
            oldReferrer = this.getReferrer(personEntity);
            if (!oldReferrer) {
                const result: Result<string, DomainError> = await this.usernameGenerator.generateUsername(
                    person.vorname,
                    person.familienname,
                );
                if (!result.ok) {
                    return result.error;
                }
                oldReferrer = result.value;
            }
        }

        personEntity.assign(mapAggregateToData(person));
        await this.em.persistAndFlush(personEntity);

        if (isPersonRenamedEventNecessary) {
            this.eventService.publish(PersonRenamedEvent.fromPerson(person, oldReferrer));
            // wait for privacyIDEA to update the username
            await new Promise<void>((resolve: () => void) =>
                setTimeout(resolve, this.PRIVACYIDEA_RENAME_WAITING_TIME_IN_SECONDS * 1000),
            );
        }

        return mapEntityToAggregate(personEntity);
    }

    private hasChangedNames(personEntity: PersonEntity, person: Person<true>): boolean {
        const oldVorname: string = personEntity.vorname.toLowerCase();
        const oldFamilienname: string = personEntity.familienname.toLowerCase();
        const newVorname: string = person.vorname.toLowerCase();
        const newFamilienname: string = person.familienname.toLowerCase();

        //NOT only look for first letter, because email-address is full-firstname.full-lastname@domain.de
        if (oldVorname !== newVorname) return true;

        return oldFamilienname !== newFamilienname;
    }

    private async createKeycloakUser(
        person: Person<true>,
        kcUserService: KeycloakUserService,
    ): Promise<Person<true> | DomainError> {
        if (person.keycloakUserId || !person.newPassword || !person.username) {
            return new EntityCouldNotBeCreated('Person');
        }

        person.referrer = person.username;
        const userDo: User<false> = User.createNew(person.username, undefined, {
            ID_ITSLEARNING: [person.id],
            ID_OX: [person.id],
        });

        const creationResult: Result<string, DomainError> = await kcUserService.create(userDo);
        if (!creationResult.ok) {
            return creationResult.error;
        }
        person.keycloakUserId = creationResult.value;

        const setPasswordResult: Result<string, DomainError> = await kcUserService.setPassword(
            person.keycloakUserId,
            person.newPassword,
            person.isNewPasswordTemporary,
        );
        if (!setPasswordResult.ok) {
            await kcUserService.delete(person.keycloakUserId);
            return setPasswordResult.error;
        }

        return person;
    }

    public async save(person: Person<boolean>): Promise<Person<true> | DomainError> {
        if (person.id) {
            return this.update(person);
        }
        return this.create(person);
    }

    private async createKeycloakUserWithHashedPassword(
        person: Person<true>,
        hashedPassword: string,
        kcUserService: KeycloakUserService,
    ): Promise<Person<true> | DomainError> {
        if (person.keycloakUserId || !person.username) {
            return new EntityCouldNotBeCreated('Person');
        }
        person.referrer = person.username;
        const userDo: User<false> = User.createNew(person.username, undefined, {
            ID_ITSLEARNING: [person.id],
        });

        const creationResult: Result<string, DomainError> = await kcUserService.createWithHashedPassword(
            userDo,
            hashedPassword,
        );
        if (!creationResult.ok) {
            return creationResult.error;
        }
        person.keycloakUserId = creationResult.value;

        return person;
    }

    public async findbyPersonFrontend(
        queryParams: PersonenQueryParams,
        permittedOrgas: PermittedOrgas,
    ): Promise<Counted<Person<true>>> {
        const scope: PersonScope = this.createPersonScope(queryParams, permittedOrgas);

        const [entities, total]: Counted<PersonEntity> = await scope.executeQuery(this.em);
        const persons: Person<true>[] = entities.map((entity: PersonEntity) => mapEntityToAggregate(entity));

        return [persons, total];
    }

    public createPersonScope(queryParams: PersonenQueryParams, permittedOrgas: PermittedOrgas): PersonScope {
        const scope: PersonScope = new PersonScope()
            .setScopeWhereOperator(ScopeOperator.AND)
            .findBy({
                vorname: queryParams.vorname,
                familienname: queryParams.familienname,
                geburtsdatum: undefined,
                organisationen: permittedOrgas.all ? undefined : permittedOrgas.orgaIds,
            })
            .findByPersonenKontext(queryParams.organisationIDs, queryParams.rolleIDs)
            .paged(queryParams.offset, queryParams.limit);

        const sortField: SortFieldPersonFrontend = queryParams.sortField || SortFieldPersonFrontend.VORNAME;
        const sortOrder: ScopeOrder = queryParams.sortOrder || ScopeOrder.ASC;
        scope.sortBy(sortField, sortOrder);

        if (queryParams.suchFilter) {
            scope.findBySearchString(queryParams.suchFilter);
        }

        return scope;
    }

    public async isPersonalnummerAlreadayAssigned(personalnummer: string): Promise<boolean> {
        const person: Option<Loaded<PersonEntity, never, '*', never>> = await this.em.findOne(PersonEntity, {
            personalnummer: personalnummer,
        });

        return !!person;
    }

    public async updatePersonMetadata(
        personId: string,
        familienname: string,
        vorname: string,
        personalnummer: string | undefined,
        lastModified: Date,
        revision: string,
        permissions: PersonPermissions,
    ): Promise<Person<true> | DomainError> {
        const personFound: Option<Person<true>> = await this.findById(personId);
        if (!personFound) {
            return new EntityNotFoundError('Person', personId);
        }

        //Permissions: Only the admin can update the person metadata.
        if (!(await permissions.canModifyPerson(personId))) {
            return new MissingPermissionsError('Not allowed to update the person metadata for the person.');
        }

        if (!NameValidator.isNameValid(vorname)) {
            return new VornameForPersonWithTrailingSpaceError();
        }
        if (!NameValidator.isNameValid(familienname)) {
            return new FamiliennameForPersonWithTrailingSpaceError();
        }

        const hasNameChanged: boolean = this.hasNameChanged(
            personFound.vorname,
            personFound.familienname,
            vorname,
            familienname,
        );

        const hasUsernameChanged: boolean = this.hasUsernameChanged(
            personFound.vorname,
            personFound.familienname,
            vorname,
            familienname,
        );

        if (!hasNameChanged && !personalnummer) {
            return new PersonalnummerRequiredError();
        }

        if (personFound.updatedAt.getTime() > lastModified.getTime()) {
            return new PersonUpdateOutdatedError();
        }

        let newPersonalnummer: string | undefined = undefined;
        let newVorname: string | undefined = undefined;
        let newFamilienname: string | undefined = undefined;
        const oldUsername: string = personFound.referrer!;
        let username: string = oldUsername;

        //Update personalnummer
        if (personalnummer) {
            if (!NameValidator.isNameValid(personalnummer)) {
                return new PersonalNummerForPersonWithTrailingSpaceError();
            }
            if (await this.isPersonalnummerAlreadayAssigned(personalnummer)) {
                return new DuplicatePersonalnummerError(`Personalnummer ${personalnummer} already exists.`);
            }
            newPersonalnummer = personalnummer;

            // Remove KoPers-Lock, if existing
            const userLocks: UserLock[] | undefined = await this.userLockRepository.findByPersonId(personId);

            if (userLocks && userLocks.length > 0) {
                const koperslock: UserLock | undefined = userLocks.find(
                    (lock: UserLock) => lock.locked_occasion === PersonLockOccasion.KOPERS_GESPERRT,
                );
                if (koperslock && personFound.keycloakUserId) {
                    await this.kcUserService.updateKeycloakUserStatus(
                        personId,
                        personFound.keycloakUserId,
                        koperslock,
                        false,
                    );
                }
            }
        }
        //Update name
        if (hasNameChanged) {
            newVorname = vorname;
            newFamilienname = familienname;

            if (hasUsernameChanged) {
                //Generate new username
                const result: Result<string, DomainError> = await this.usernameGenerator.generateUsername(
                    vorname,
                    familienname,
                );
                if (!result.ok) {
                    return result.error;
                }
                username = result.value;
            }
        }

        const error: void | DomainError = personFound.update(
            revision,
            newFamilienname,
            newVorname,
            username,
            personFound.stammorganisation,
            personFound.initialenFamilienname,
            personFound.initialenVorname,
            personFound.rufname,
            personFound.nameTitel,
            personFound.nameAnrede,
            personFound.namePraefix,
            personFound.nameSuffix,
            personFound.nameSortierindex,
            personFound.geburtsdatum,
            personFound.geburtsort,
            personFound.geschlecht,
            personFound.lokalisierung,
            personFound.vertrauensstufe,
            personFound.auskunftssperre,
            newPersonalnummer,
            personFound.userLock,
            personFound.orgUnassignmentDate,
            personFound.isLocked,
            personFound.email,
        );
        if (error instanceof DomainError) {
            return error;
        }

        //Update username in kc
        if (hasUsernameChanged) {
            const kcUsernameUpdated: Result<void, DomainError> = await this.kcUserService.updateUsername(
                oldUsername,
                username,
            );
            if (!kcUsernameUpdated.ok) {
                return kcUsernameUpdated.error;
            }
        }

        const savedPerson: Person<true> | DomainError = await this.save(personFound);
        return savedPerson;
    }

    private hasNameChanged(
        oldVorname: string,
        oldFamilienname: string,
        newVorname: string,
        newFamilienname: string,
    ): boolean {
        return oldVorname !== newVorname || oldFamilienname !== newFamilienname;
    }

    private hasUsernameChanged(
        oldVorname: string,
        oldFamilienname: string,
        newVorname: string,
        newFamilienname: string,
    ): boolean {
        const oldVornameLowerCase: string = toDIN91379SearchForm(oldVorname).toLowerCase();
        const oldFamiliennameLowerCase: string = toDIN91379SearchForm(oldFamilienname).toLowerCase();
        const newVornameLowerCase: string = toDIN91379SearchForm(newVorname).toLowerCase();
        const newFamiliennameLowerCase: string = toDIN91379SearchForm(newFamilienname).toLowerCase();

        if (oldVornameLowerCase[0] !== newVornameLowerCase[0]) return true;

        return oldFamiliennameLowerCase !== newFamiliennameLowerCase;
    }

    public async getKoPersUserLockList(): Promise<[PersonID, string][]> {
        const daysAgo: Date = new Date();
        daysAgo.setDate(daysAgo.getDate() - 56);

        const filters: QBFilterQuery<PersonEntity> = {
            $and: [
                { personalnummer: { $eq: null } },
                {
                    personenKontexte: {
                        $some: {
                            createdAt: { $lte: daysAgo }, //Check that createdAt is older than 56 days
                            rolleId: {
                                merkmale: { merkmal: RollenMerkmal.KOPERS_PFLICHT },
                            },
                        },
                    },
                },
            ],
        };

        const personEntities: PersonEntity[] = await this.em.find(PersonEntity, filters);
        return personEntities.map((person: PersonEntity) => [person.id, person.keycloakUserId]);
    }

    public async getPersonWithoutOrgDeleteList(): Promise<string[]> {
        const daysAgo: Date = new Date();
        daysAgo.setDate(daysAgo.getDate() - 84);

        const filters: QBFilterQuery<PersonEntity> = {
            personenKontexte: {
                $exists: false,
            },
            org_unassignment_date: {
                $lte: daysAgo,
            },
        };

        const personEntities: PersonEntity[] = await this.em.find(PersonEntity, filters);
        return personEntities.map((person: PersonEntity) => person.id);
    }
}
