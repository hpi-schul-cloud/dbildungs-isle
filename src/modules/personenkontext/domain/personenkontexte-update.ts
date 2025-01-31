import { DbiamPersonenkontextBodyParams } from '../api/param/dbiam-personenkontext.body.params.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { Personenkontext } from './personenkontext.js';
import { UpdateCountError } from './error/update-count.error.js';
import { UpdateOutdatedError } from './error/update-outdated.error.js';
import { OrganisationID, PersonID, RolleID } from '../../../shared/types/index.js';
import { UpdatePersonIdMismatchError } from './error/update-person-id-mismatch.error.js';
import { PersonenkontexteUpdateError } from './error/personenkontexte-update.error.js';
import { PersonenkontextFactory } from './personenkontext.factory.js';
import { EventService } from '../../../core/eventbus/index.js';
import { UpdatePersonNotFoundError } from './error/update-person-not-found.error.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Person } from '../../person/domain/person.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import { UpdateInvalidRollenartForLernError } from './error/update-invalid-rollenart-for-lern.error.js';
import { IPersonPermissions } from '../../../shared/permissions/person-permissions.interface.js';
import { CheckRollenartSpecification } from '../specification/nur-gleiche-rolle.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { CheckBefristungSpecification } from '../specification/befristung-required-bei-rolle-befristungspflicht.js';
import { PersonenkontextBefristungRequiredError } from './error/personenkontext-befristung-required.error.js';
import { DBiamPersonenkontextRepoInternal } from '../persistence/internal-dbiam-personenkontext.repo.js';

export class PersonenkontexteUpdate {
    private constructor(
        private readonly eventService: EventService,
        private readonly logger: ClassLogger,
        private readonly dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly dBiamPersonenkontextRepoInternal: DBiamPersonenkontextRepoInternal,
        private readonly personRepo: PersonRepository,
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepo: OrganisationRepository,
        private readonly personenkontextFactory: PersonenkontextFactory,
        private readonly personId: PersonID,
        private readonly lastModified: Date | undefined,
        private readonly count: number,
        private readonly dBiamPersonenkontextBodyParams: DbiamPersonenkontextBodyParams[],
        private readonly permissions: IPersonPermissions,
        private readonly personalnummer?: string,
    ) {}

    public static createNew(
        eventService: EventService,
        logger: ClassLogger,
        dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        dBiamPersonenkontextRepoInternal: DBiamPersonenkontextRepoInternal,
        personRepo: PersonRepository,
        rolleRepo: RolleRepo,
        organisationRepo: OrganisationRepository,
        personenkontextFactory: PersonenkontextFactory,
        personId: PersonID,
        lastModified: Date | undefined,
        count: number,
        dBiamPersonenkontextBodyParams: DbiamPersonenkontextBodyParams[],
        permissions: IPersonPermissions,
        personalnummer?: string,
    ): PersonenkontexteUpdate {
        return new PersonenkontexteUpdate(
            eventService,
            logger,
            dBiamPersonenkontextRepo,
            dBiamPersonenkontextRepoInternal,
            personRepo,
            rolleRepo,
            organisationRepo,
            personenkontextFactory,
            personId,
            lastModified,
            count,
            dBiamPersonenkontextBodyParams,
            permissions,
            personalnummer,
        );
    }

    /* eslint-disable no-await-in-loop */
    private async getSentPersonenkontexte(): Promise<Personenkontext<boolean>[] | PersonenkontexteUpdateError> {
        const personenKontexte: Personenkontext<boolean>[] = [];
        for (const pkBodyParam of this.dBiamPersonenkontextBodyParams) {
            if (pkBodyParam.personId != this.personId) {
                return new UpdatePersonIdMismatchError();
            }
            const pk: Option<Personenkontext<true>> = await this.dBiamPersonenkontextRepo.find(
                pkBodyParam.personId,
                pkBodyParam.organisationId,
                pkBodyParam.rolleId,
            );
            if (!pk) {
                const newPK: Personenkontext<false> = this.personenkontextFactory.createNew(
                    pkBodyParam.personId,
                    pkBodyParam.organisationId,
                    pkBodyParam.rolleId,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    pkBodyParam.befristung,
                );
                personenKontexte.push(newPK); // New
            } else {
                personenKontexte.push(pk); // Old
            }
        }

        return personenKontexte;
    }

    /* eslint-disable no-await-in-loop */
    private async validate(existingPKs: Personenkontext<true>[]): Promise<Option<PersonenkontexteUpdateError>> {
        const person: Option<Person<true>> = await this.personRepo.findById(this.personId);

        if (!person) {
            return new UpdatePersonNotFoundError();
        }

        if (existingPKs.length !== this.count) {
            return new UpdateCountError();
        }

        if (existingPKs.length === 0) {
            // If there are no existing PKs and lastModified is undefined, it's okay and validation stops here with no error
            return null;
        }

        const sortedExistingPKs: Personenkontext<true>[] = existingPKs.sort(
            (pk1: Personenkontext<true>, pk2: Personenkontext<true>) => (pk1.updatedAt < pk2.updatedAt ? 1 : -1),
        );
        const mostRecentUpdatedAt: Date | undefined = sortedExistingPKs[0]?.updatedAt;

        if (this.lastModified === undefined) {
            // If there are existing PKs but lastModified is undefined, return an error
            return new UpdateOutdatedError();
        }

        if (mostRecentUpdatedAt && mostRecentUpdatedAt.getTime() > this.lastModified.getTime()) {
            // The existing data is newer than the incoming update
            return new UpdateOutdatedError();
        }

        // If mostRecentUpdatedAt is less than or equal to this.lastModified, no error is returned
        return null;
    }

    private async checkPermissionsForChanged(
        existingPKs: Personenkontext<true>[],
        sentPKs: Personenkontext<true>[],
    ): Promise<Option<DomainError>> {
        // Check if the target person can be modified
        if (!(await this.permissions.canModifyPerson(this.personId))) {
            return new MissingPermissionsError('Can not modify person');
        }

        // Find all new and deleted personenkontexte
        const modifiedPKs: Personenkontext<true>[] = [];

        for (const existingPK of existingPKs) {
            if (
                !sentPKs.some(
                    (pk: Personenkontext<true>) =>
                        pk.personId === existingPK.personId &&
                        pk.organisationId === existingPK.organisationId &&
                        pk.rolleId === existingPK.rolleId,
                )
            ) {
                modifiedPKs.push(existingPK);
            }
        }

        for (const sentPK of sentPKs) {
            if (
                !existingPKs.some(
                    (pk: Personenkontext<true>) =>
                        pk.personId === sentPK.personId &&
                        pk.organisationId === sentPK.organisationId &&
                        pk.rolleId === sentPK.rolleId,
                )
            ) {
                modifiedPKs.push(sentPK);
            }
        }

        const modifiedOrgIDs: OrganisationID[] = [
            ...new Set(modifiedPKs.map((pk: Personenkontext<true>) => pk.organisationId)),
        ];

        // Check for permissions at the target organisations
        const hasPermissions: boolean = (
            await Promise.all(
                modifiedOrgIDs.map((orgID: OrganisationID) =>
                    this.permissions.hasSystemrechtAtOrganisation(orgID, RollenSystemRecht.PERSONEN_VERWALTEN),
                ),
            )
        ).every(Boolean);

        if (!hasPermissions) {
            return new MissingPermissionsError('Can not modify person');
        }

        return undefined;
    }

    private async delete(
        existingPKs: Personenkontext<true>[],
        sentPKs: Personenkontext<boolean>[],
    ): Promise<Personenkontext<true>[]> {
        const deletedPKs: Personenkontext<true>[] = [];

        for (const existingPK of existingPKs) {
            if (
                !sentPKs.some(
                    (pk: Personenkontext<true>) =>
                        pk.personId == existingPK.personId &&
                        pk.organisationId == existingPK.organisationId &&
                        pk.rolleId == existingPK.rolleId,
                )
            ) {
                try {
                    /* eslint-disable no-await-in-loop */
                    await this.dBiamPersonenkontextRepoInternal.delete(existingPK).then(() => {});
                    deletedPKs.push(existingPK);
                    this.logger.info(
                        `Schulzuordnung (Organisation:${existingPK.organisationId}, Rolle:${existingPK.rolleId}) für Benutzer mit BenutzerId: {${existingPK.personId}}.'}`,
                    );
                    /* eslint-disable no-await-in-loop */
                } catch (err) {
                    this.logger.error(`Personenkontext with ID ${existingPK.id} could not be deleted!`, err);
                }
            }
        }

        return deletedPKs;
    }

    /* eslint-disable no-await-in-loop */
    private async add(
        existingPKs: Personenkontext<true>[],
        sentPKs: Personenkontext<boolean>[],
    ): Promise<Personenkontext<true>[]> {
        const createdPKs: Personenkontext<true>[] = [];

        for (const sentPK of sentPKs) {
            if (
                !existingPKs.some(
                    (existingPK: Personenkontext<true>) =>
                        existingPK.personId == sentPK.personId &&
                        existingPK.organisationId == sentPK.organisationId &&
                        existingPK.rolleId == sentPK.rolleId,
                )
            ) {
                try {
                    const savedPK: Personenkontext<true> = await this.dBiamPersonenkontextRepoInternal.save(sentPK);
                    createdPKs.push(savedPK);
                    this.logger.info(
                        `Schulzuordnung (Organisation:${sentPK.organisationId}, Rolle:${sentPK.rolleId}) für Benutzer mit BenutzerId: {${sentPK.personId}}. Befristung: ${sentPK.befristung?.toDateString() ?? 'unbefristet'}`,
                    );
                } catch (err) {
                    this.logger.error(
                        `Personenkontext with (person: ${sentPK.personId}, organisation: ${sentPK.organisationId}, rolle: ${sentPK.rolleId}) could not be added!`,
                        err,
                    );
                }
            }
        }
        /* eslint-disable no-await-in-loop */

        return createdPKs;
    }

    private async checkRollenartSpecification(
        sentPKs: Personenkontext<boolean>[],
    ): Promise<Option<PersonenkontexteUpdateError>> {
        const isSatisfied: boolean = await new CheckRollenartSpecification(
            this.dBiamPersonenkontextRepo,
            this.rolleRepo,
        ).isSatisfiedBy(sentPKs);

        if (!isSatisfied) {
            return new UpdateInvalidRollenartForLernError();
        }

        return undefined;
    }

    private async checkBefristungSpecification(
        sentPKs: Personenkontext<boolean>[],
    ): Promise<Option<PersonenkontexteUpdateError>> {
        const isSatisfied: boolean = await new CheckBefristungSpecification(this.rolleRepo).isSatisfiedBy(sentPKs);

        if (!isSatisfied) {
            return new PersonenkontextBefristungRequiredError();
        }

        return undefined;
    }

    public async update(ldapEntryUUID?: string): Promise<Personenkontext<true>[] | PersonenkontexteUpdateError> {
        //If first lehrer kontext is created and a UUID is passed as ldapEntryUUID it is used as internal LDAP entryUUID (needed for migration, can be build back afterwards)
        const sentPKs: Personenkontext<true>[] | PersonenkontexteUpdateError = await this.getSentPersonenkontexte();
        if (sentPKs instanceof PersonenkontexteUpdateError) {
            return sentPKs;
        }

        const existingPKs: Personenkontext<true>[] = await this.dBiamPersonenkontextRepo.findByPerson(this.personId);

        const validationForLernError: Option<PersonenkontexteUpdateError> =
            await this.checkRollenartSpecification(sentPKs);
        if (validationForLernError) {
            return validationForLernError;
        }

        const validationForBefristung: Option<PersonenkontexteUpdateError> =
            await this.checkBefristungSpecification(sentPKs);
        if (validationForBefristung) {
            return validationForBefristung;
        }
        const validationError: Option<PersonenkontexteUpdateError> = await this.validate(existingPKs);
        if (validationError) {
            return validationError;
        }

        const permissionsError: Option<DomainError> = await this.checkPermissionsForChanged(existingPKs, sentPKs);
        if (permissionsError) {
            return permissionsError;
        }

        const deletedPKs: Personenkontext<true>[] = await this.delete(existingPKs, sentPKs);
        const createdPKs: Personenkontext<true>[] = await this.add(existingPKs, sentPKs);

        const existingPKsAfterUpdate: Personenkontext<true>[] = await this.dBiamPersonenkontextRepo.findByPerson(
            this.personId,
        );

        // Update the personalnummer if it is provided
        if (this.personalnummer) {
            const person: Option<Person<true>> = await this.personRepo.findById(this.personId);
            if (person) {
                person.personalnummer = this.personalnummer;
                await this.personRepo.save(person);
            }
        }

        // Set value with current date in database, when person has no Personenkontext anymore
        if (existingPKsAfterUpdate.length == 0) {
            const person: Option<Person<true>> = await this.personRepo.findById(this.personId);
            if (person) {
                person.orgUnassignmentDate = new Date();
                await this.personRepo.save(person);
            }
        } else {
            const person: Option<Person<true>> = await this.personRepo.findById(this.personId);
            if (person && person.orgUnassignmentDate) {
                person.orgUnassignmentDate = undefined;
                await this.personRepo.save(person);
            }
        }

        await this.publishEvent(deletedPKs, createdPKs, existingPKsAfterUpdate, ldapEntryUUID);

        return existingPKsAfterUpdate;
    }

    private async publishEvent(
        deletedPKs: Personenkontext<true>[],
        createdPKs: Personenkontext<true>[],
        existingPKs: Personenkontext<true>[],
        ldapEntryUUID?: string,
    ): Promise<void> {
        const deletedRollenIDs: RolleID[] = deletedPKs.map((pk: Personenkontext<true>) => pk.rolleId);
        const createdRollenIDs: RolleID[] = createdPKs.map((pk: Personenkontext<true>) => pk.rolleId);
        const existingRollenIDs: RolleID[] = existingPKs.map((pk: Personenkontext<true>) => pk.rolleId);
        const rollenIDs: Set<RolleID> = new Set([...deletedRollenIDs, ...createdRollenIDs, ...existingRollenIDs]);

        const deletedOrgaIDs: OrganisationID[] = deletedPKs.map((pk: Personenkontext<true>) => pk.organisationId);
        const createdOrgaIDs: OrganisationID[] = createdPKs.map((pk: Personenkontext<true>) => pk.organisationId);
        const existingOrgaIDs: OrganisationID[] = existingPKs.map((pk: Personenkontext<true>) => pk.organisationId);
        const orgaIDs: Set<OrganisationID> = new Set([...deletedOrgaIDs, ...createdOrgaIDs, ...existingOrgaIDs]);

        const [person, orgas, rollen]: [
            Option<Person<true>>,
            Map<OrganisationID, Organisation<true>>,
            Map<RolleID, Rolle<true>>,
        ] = await Promise.all([
            this.personRepo.findById(this.personId),
            this.organisationRepo.findByIds([...orgaIDs]),
            this.rolleRepo.findByIds([...rollenIDs]),
        ]);

        if (!person) {
            this.logger.error(
                `Could not find person with ID ${this.personId} while building PersonenkontextUpdatedEvent`,
            );
            return; // Person can not be found
        }

        this.eventService.publish(
            PersonenkontextUpdatedEvent.fromPersonenkontexte(
                person,
                createdPKs.map((pk: Personenkontext<true>) => [
                    pk,
                    orgas.get(pk.organisationId)!,
                    rollen.get(pk.rolleId)!,
                ]),
                deletedPKs.map((pk: Personenkontext<true>) => [
                    pk,
                    orgas.get(pk.organisationId)!,
                    rollen.get(pk.rolleId)!,
                ]),
                existingPKs.map((pk: Personenkontext<true>) => [
                    pk,
                    orgas.get(pk.organisationId)!,
                    rollen.get(pk.rolleId)!,
                ]),
                ldapEntryUUID,
            ),
        );
    }
}
