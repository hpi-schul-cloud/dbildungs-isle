import { randomUUID } from 'node:crypto';
import { EntityManager, Loaded, RequiredEntityData } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataConfig } from '../../../shared/config/data.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import {
    DomainError,
    EntityCouldNotBeCreated,
    EntityCouldNotBeDeleted,
    EntityNotFoundError,
} from '../../../shared/error/index.js';
import { ScopeOperator, ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { OrganisationID, PersonID } from '../../../shared/types/aggregate-ids.types.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { KeycloakUserService, LockKeys, PersonHasNoKeycloakId, User } from '../../keycloak-administration/index.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Person, LockInfo } from '../domain/person.js';
import { PersonEntity } from './person.entity.js';
import { PersonScope } from './person.scope.js';
import { EventService } from '../../../core/eventbus/index.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { PersonenkontextEventKontextData } from '../../../shared/events/personenkontext-event.types.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';

export function getEnabledEmailAddress(entity: PersonEntity): string | undefined {
    for (const emailAddress of entity.emailAddresses) {
        if (emailAddress.status === EmailAddressStatus.ENABLED) return emailAddress.address;
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
        undefined,
        undefined,
        getEnabledEmailAddress(entity),
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

@Injectable()
export class PersonRepository {
    public readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly kcUserService: KeycloakUserService,
        private readonly em: EntityManager,
        private readonly eventService: EventService,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    private async getPersonScopeWithPermissions(
        permissions: PersonPermissions,
        requiredRight: RollenSystemRecht = RollenSystemRecht.PERSONEN_VERWALTEN,
    ): Promise<PersonScope> {
        // Find all organisations where user has the required permission
        let organisationIDs: OrganisationID[] | undefined = await permissions.getOrgIdsWithSystemrecht(
            [requiredRight],
            true,
        );

        // Check if user has permission on root organisation
        if (organisationIDs?.includes(this.ROOT_ORGANISATION_ID)) {
            organisationIDs = undefined;
        }

        return new PersonScope().findBy({ organisationen: organisationIDs }).setScopeWhereOperator(ScopeOperator.AND);
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

    public async getPersonIfAllowed(personId: string, permissions: PersonPermissions): Promise<Result<Person<true>>> {
        const scope: PersonScope = await this.getPersonScopeWithPermissions(permissions);
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
        if (keyCloakUserDataResponse.ok) {
            const lockInfo: LockInfo = {
                lock_locked_from: keyCloakUserDataResponse.value.attributes[LockKeys.LockedFrom]?.toString() ?? '',
                lock_timestamp: keyCloakUserDataResponse.value.attributes[LockKeys.Timestamp]?.toString() ?? '',
            };
            person.lockInfo = lockInfo;
            person.isLocked = keyCloakUserDataResponse.value.enabled === false;
        }
        return person;
    }

    public async checkIfDeleteIsAllowed(
        personId: string,
        permissions: PersonPermissions,
    ): Promise<Result<Person<true>>> {
        // Check if the user has permission to delete immediately
        const scope: PersonScope = await this.getPersonScopeWithPermissions(
            permissions,
            RollenSystemRecht.PERSONEN_SOFORT_LOESCHEN,
        );
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
        // Delete email-addresses if any, must happen before person deletion to get the referred email-address
        if (person.email) {
            this.eventService.publish(new PersonDeletedEvent(personId, person.email));
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

    public async create(person: Person<false>, hashedPassword?: string): Promise<Person<true> | DomainError> {
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
                id: randomUUID(), // Generate ID here instead of at insert-time
            });
            transaction.persist(personEntity);

            const persistedPerson: Person<true> = mapEntityToAggregateInplace(personEntity, person);

            // Take ID from person to create keycloak user
            let personWithKeycloakUser: Person<true> | DomainError;
            if (!hashedPassword) {
                personWithKeycloakUser = await this.createKeycloakUser(persistedPerson, this.kcUserService);
            } else {
                personWithKeycloakUser = await this.createKeycloakUserWithHashedPassword(
                    persistedPerson,
                    hashedPassword,
                    this.kcUserService,
                );
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

    public async update(person: Person<true>): Promise<Person<true> | DomainError> {
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

        personEntity.assign(mapAggregateToData(person));
        await this.em.persistAndFlush(personEntity);

        if (isPersonRenamedEventNecessary) {
            this.eventService.publish(new PersonRenamedEvent(person.id));
        }

        return mapEntityToAggregate(personEntity);
    }

    private hasChangedNames(personEntity: PersonEntity, person: Person<true>): boolean {
        const oldVorname: string = personEntity.vorname.toLowerCase();
        const oldFamilienname: string = personEntity.familienname.toLowerCase();
        const newVorname: string = person.vorname.toLowerCase();
        const newFamilienname: string = person.familienname.toLowerCase();

        //only look for first letter, because username is firstname[0] + lastname
        if (oldVorname[0] !== newVorname[0]) return true;

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
}
