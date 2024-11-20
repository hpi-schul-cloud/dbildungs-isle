import { Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import {
    ApiCreatedResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiInternalServerErrorResponse,
    ApiBearerAuth,
    ApiOAuth2,
    ApiTags,
} from '@nestjs/swagger';
import { PersonRepository } from '../person/persistence/person.repository.js';
import { KeycloakUserService } from '../keycloak-administration/domain/keycloak-user.service.js';
import { DomainError } from '../../shared/error/domain.error.js';
import { UserLock } from '../keycloak-administration/domain/user-lock.js';
import { PersonDeleteService } from '../person/person-deletion/person-delete.service.js';
import { DBiamPersonenkontextRepo } from '../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonPermissions } from '../authentication/domain/person-permissions.js';
import { Permissions } from '../authentication/api/permissions.decorator.js';
import { DbiamPersonenkontextBodyParams } from '../personenkontext/api/param/dbiam-personenkontext.body.params.js';
import { PersonenkontextWorkflowFactory } from '../personenkontext/domain/personenkontext-workflow.factory.js';
import { Personenkontext } from '../personenkontext/domain/personenkontext.js';
import { PersonenkontexteUpdateError } from '../personenkontext/domain/error/personenkontexte-update.error.js';
import { PersonID } from '../../shared/types/aggregate-ids.types.js';
import { UserLockRepository } from '../keycloak-administration/repository/user-lock.repository.js';
import { Person } from '../person/domain/person.js';
import { EntityNotFoundError } from '../../shared/error/entity-not-found.error.js';
import { PersonLockOccasion } from '../person/domain/person.enums.js';

@Controller({ path: 'cron' })
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@ApiTags('cron')
export class CronController {
    public constructor(
        private readonly keyCloakUserService: KeycloakUserService,
        private readonly personRepository: PersonRepository,
        private readonly personDeleteService: PersonDeleteService,
        private readonly personenKonextRepository: DBiamPersonenkontextRepo,
        private readonly personenkontextWorkflowFactory: PersonenkontextWorkflowFactory,
        private readonly userLockRepository: UserLockRepository,
    ) {}

    @Put('kopers-lock')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({ description: 'User were successfully locked.', type: Boolean })
    @ApiBadRequestResponse({ description: 'User are not given or not found' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to lock user.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to lock user.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to lock user.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while trying to lock user.' })
    public async koPersUserLock(): Promise<boolean> {
        try {
            const personIdsTouple: [PersonID, string][] = await this.personRepository.getKoPersUserLockList();

            // Check if the array is empty (personIdsTouple === 0 is incorrect for array checks)
            if (personIdsTouple.length === 0) {
                return true;
            }

            const results: PromiseSettledResult<Result<void, DomainError>>[] = await Promise.allSettled(
                personIdsTouple.map(([personId, keycloakUserId]: [PersonID, string]) => {
                    const userLock: UserLock = UserLock.construct(
                        personId,
                        'Cron',
                        undefined,
                        PersonLockOccasion.KOPERS_GESPERRT,
                        new Date(),
                    );
                    return this.keyCloakUserService.updateKeycloakUserStatus(personId, keycloakUserId, userLock, true);
                }),
            );

            // Check if all operations were successful
            const allSuccessful: boolean = results.every(
                (result: PromiseSettledResult<Result<void, DomainError>>) =>
                    result.status === 'fulfilled' && result.value.ok === true,
            );

            return allSuccessful;
        } catch (error) {
            throw new Error('Failed to lock users due to an internal server error.');
        }
    }

    @Put('kontext-expired')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({ description: 'Personenkontexte were successfully removed from users.', type: Boolean })
    @ApiBadRequestResponse({ description: 'Personenkontexte are not given or not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to remove personenkontexte from users.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to remove personenkontexte from users.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to remove personenkontexte from users.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while trying to remove personenkontexte from users.',
    })
    public async removePersonenKontexteWithExpiredBefristungFromUsers(
        @Permissions() permissions: PersonPermissions,
    ): Promise<boolean> {
        try {
            //Get PersonenKontexte for a person at least one kontext exceeds the befristung value
            const personenKontexteGroupedByPersonId: Map<PersonID, Personenkontext<true>[]> =
                await this.personenKonextRepository.getPersonenKontexteWithExpiredBefristung();
            if (personenKontexteGroupedByPersonId.size === 0) {
                return true;
            }

            // Filter each Personenkontext and validate Personenkontexte to keep for each person
            const promises: Promise<Personenkontext<true>[] | PersonenkontexteUpdateError>[] = [];
            personenKontexteGroupedByPersonId.forEach(
                (personenKontexte: Personenkontext<true>[], personId: PersonID) => {
                    const count: number = personenKontexte.length;
                    // Filter PersonenKontexte
                    const personenKontexteToKeep: DbiamPersonenkontextBodyParams[] =
                        this.filterPersonenKontexte(personenKontexte);
                    // Validate PersonenKontexte to keep
                    promises.push(
                        this.personenkontextWorkflowFactory
                            .createNew()
                            .commit(personId, new Date(), count, personenKontexteToKeep, permissions),
                    );
                },
            );

            //validate results
            const results: PromiseSettledResult<Personenkontext<true>[] | PersonenkontexteUpdateError>[] =
                await Promise.allSettled(promises);
            const allSuccessful: boolean = results.every(
                (result: PromiseSettledResult<Personenkontext<true>[] | PersonenkontexteUpdateError>) =>
                    result.status === 'fulfilled' && !(result.value instanceof PersonenkontexteUpdateError),
            );

            return allSuccessful;
        } catch (error) {
            throw new Error('Failed to remove kontexte due to an internal server error.');
        }
    }

    private filterPersonenKontexte(personenKontexte: Personenkontext<true>[]): DbiamPersonenkontextBodyParams[] {
        const today: Date = new Date();
        today.setHours(0, 0, 0, 0);
        const personenKontexteToKeep: DbiamPersonenkontextBodyParams[] = [];
        personenKontexte.forEach((personenKontext: Personenkontext<true>) => {
            if (!personenKontext.befristung || personenKontext.befristung >= today) {
                personenKontexteToKeep.push({
                    personId: personenKontext.personId,
                    organisationId: personenKontext.organisationId,
                    rolleId: personenKontext.rolleId,
                    befristung: personenKontext.befristung,
                });
            }
        });
        return personenKontexteToKeep;
    }

    @Put('person-without-org')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({ description: 'User were successfully removed.', type: Boolean })
    @ApiBadRequestResponse({ description: 'User are not given or not found' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to remove user.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to delete user.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to delete user.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while trying to remove user.' })
    public async personWithoutOrgDelete(@Permissions() permissions: PersonPermissions): Promise<boolean> {
        try {
            const personIds: string[] = await this.personRepository.getPersonWithoutOrgDeleteList();
            if (personIds.length === 0) {
                return true;
            }

            const results: PromiseSettledResult<Result<void, DomainError>>[] = await Promise.allSettled(
                personIds.map((id: string) => this.personDeleteService.deletePerson(id, permissions)),
            );

            const allSuccessful: boolean = results.every(
                (result: PromiseSettledResult<Result<void, DomainError>>) =>
                    result.status === 'fulfilled' && result.value.ok === true,
            );

            return allSuccessful;
        } catch (error) {
            throw new Error('Failed to remove users due to an internal server error.');
        }
    }

    @Put('unlock')
    @ApiOkResponse({
        description: 'The users were successfully unlocked.',
        type: Boolean,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to unlock users.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to unlock users.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to unlock users.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while trying to unlock users.' })
    public async unlockUsersWithExpiredLocks(@Permissions() permissions: PersonPermissions): Promise<boolean> {
        try {
            const userLocks: UserLock[] = await this.userLockRepository.getLocksToUnlock();
            if (userLocks.length === 0) {
                return true;
            }

            const results: PromiseSettledResult<Result<void, DomainError>>[] = await Promise.allSettled(
                userLocks.map(async (userLock: UserLock) => {
                    const person: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
                        userLock.person,
                        permissions,
                    );
                    if (!person.ok || !person.value.keycloakUserId) {
                        return { ok: false, error: new EntityNotFoundError() };
                    }
                    return this.keyCloakUserService.updateKeycloakUserStatus(
                        person.value.id,
                        person.value.keycloakUserId,
                        userLock,
                        false,
                    );
                }),
            );

            const allSuccessful: boolean = results.every(
                (result: PromiseSettledResult<Result<void, DomainError>>) =>
                    result.status === 'fulfilled' && result.value.ok === true,
            );

            return allSuccessful;
        } catch (error) {
            throw new Error('Failed to unlock users due to an internal server error.');
        }
    }
}
