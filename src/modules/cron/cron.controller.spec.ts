import { Test, TestingModule } from '@nestjs/testing';
import { CronController } from './cron.controller.js';
import { KeycloakUserService } from '../keycloak-administration/domain/keycloak-user.service.js';
import { PersonRepository } from '../person/persistence/person.repository.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { KeycloakClientError } from '../../shared/error/keycloak-client.error.js';
import { DBiamPersonenkontextRepo } from '../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextWorkflowFactory } from '../personenkontext/domain/personenkontext-workflow.factory.js';
import { PersonPermissions } from '../authentication/domain/person-permissions.js';
import { DoFactory } from '../../../test/utils/do-factory.js';
import { Personenkontext } from '../personenkontext/domain/personenkontext.js';
import { Person } from '../person/domain/person.js';
import { PersonenkontextWorkflowAggregate } from '../personenkontext/domain/personenkontext-workflow.js';
import { PersonenkontexteUpdateError } from '../personenkontext/domain/error/personenkontexte-update.error.js';

describe('CronController', () => {
    let cronController: CronController;
    let keycloakUserServiceMock: DeepMocked<KeycloakUserService>;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let personenKontextRepositoryMock: DeepMocked<DBiamPersonenkontextRepo>;
    let personenkontextWorkflowFactoryMock: DeepMocked<PersonenkontextWorkflowFactory>;
    let permissionsMock: DeepMocked<PersonPermissions>;
    let personenkontextWorkflowMock: DeepMocked<PersonenkontextWorkflowAggregate>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonenkontextWorkflowFactory,
                    useValue: createMock<PersonenkontextWorkflowFactory>(),
                },
                {
                    provide: PersonenkontextWorkflowAggregate,
                    useValue: createMock<PersonenkontextWorkflowAggregate>(),
                },
            ],
            controllers: [CronController],
        }).compile();

        cronController = module.get(CronController);
        keycloakUserServiceMock = module.get(KeycloakUserService);
        personenKontextRepositoryMock = module.get(DBiamPersonenkontextRepo);
        personRepositoryMock = module.get(PersonRepository);
        personenkontextWorkflowFactoryMock = module.get(PersonenkontextWorkflowFactory);
        personenkontextWorkflowMock = module.get(PersonenkontextWorkflowAggregate);
        permissionsMock = createMock<PersonPermissions>();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('/PUT cron/kopers-lock', () => {
        describe('when there are users to lock', () => {
            it('should return true when all users are successfully locked', async () => {
                const mockKeycloakIds: string[] = ['user1', 'user2', 'user3'];
                personRepositoryMock.getKoPersUserLockList.mockResolvedValueOnce(mockKeycloakIds);
                keycloakUserServiceMock.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });
                keycloakUserServiceMock.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });
                keycloakUserServiceMock.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });

                const result: boolean = await cronController.koPersUserLock();

                expect(result).toBe(true);
                expect(personRepositoryMock.getKoPersUserLockList).toHaveBeenCalled();
                expect(keycloakUserServiceMock.updateKeycloakUserStatus).toHaveBeenCalledTimes(mockKeycloakIds.length);
            });
        });

        describe('when there are no users to lock', () => {
            it('should return false', async () => {
                personRepositoryMock.getKoPersUserLockList.mockResolvedValueOnce([]);

                const result: boolean = await cronController.koPersUserLock();

                expect(result).toBe(true);
                expect(personRepositoryMock.getKoPersUserLockList).toHaveBeenCalled();
            });
        });

        describe('when locking users fails', () => {
            it('should return false when at least one user fails to lock', async () => {
                const mockKeycloakIds: string[] = ['user1', 'user2'];
                personRepositoryMock.getKoPersUserLockList.mockResolvedValueOnce(mockKeycloakIds);
                keycloakUserServiceMock.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });
                keycloakUserServiceMock.updateKeycloakUserStatus.mockResolvedValueOnce({
                    ok: false,
                    error: new KeycloakClientError('Could not update user status or custom attributes'),
                });

                const result: boolean = await cronController.koPersUserLock();

                expect(result).toBe(false);
                expect(personRepositoryMock.getKoPersUserLockList).toHaveBeenCalled();
                expect(keycloakUserServiceMock.updateKeycloakUserStatus).toHaveBeenCalledTimes(mockKeycloakIds.length);
            });
        });

        describe('when an exception is thrown', () => {
            it('should throw an error when there is an internal error', async () => {
                personRepositoryMock.getKoPersUserLockList.mockImplementationOnce(() => {
                    throw new Error('Some internal error');
                });

                await expect(cronController.koPersUserLock()).rejects.toThrow(
                    'Failed to lock users due to an internal server error.',
                );
            });
        });
    });

    describe('/PUT cron/kontext-exceeding', () => {
        describe('when there are organisations to remove', () => {
            it('should return true when all personenKontexte are successfully removed', async () => {
                const today: Date = new Date();
                const daysAgo: Date = new Date();
                daysAgo.setDate(daysAgo.getDate() - 1);
                const person1: Person<true> = DoFactory.createPerson(true);
                const person2: Person<true> = DoFactory.createPerson(true);
                const person3: Person<true> = DoFactory.createPerson(true);
                const personenKontextMock1: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person1.id,
                });
                const personenKontextMock2: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person2.id,
                });
                const personenKontextMock3: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person3.id,
                });
                const personenKontextMock4: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: today,
                    personId: person1.id,
                });
                const personenKontextMock5: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: today,
                    personId: person2.id,
                });

                const mockPersonenKontexte: Record<string, Personenkontext<true>[]> = {
                    [person1.id]: [personenKontextMock1, personenKontextMock4],
                    [person2.id]: [personenKontextMock2, personenKontextMock5],
                    [person3.id]: [personenKontextMock3],
                };

                personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung.mockResolvedValueOnce(
                    mockPersonenKontexte,
                );

                const result: boolean =
                    await cronController.removePersonenKontexteWithExceedingLimitFromUsers(permissionsMock);

                expect(result).toBe(true);
                expect(personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung).toHaveBeenCalled();
                expect(personenkontextWorkflowFactoryMock.createNew).toHaveBeenCalledTimes(3);
            });
        });

        describe('when there are no organisations to remove', () => {
            it('should return true when no organisations exceed their limit', async () => {
                personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung.mockResolvedValueOnce({});

                const result: boolean =
                    await cronController.removePersonenKontexteWithExceedingLimitFromUsers(permissionsMock);

                expect(result).toBe(true);
                expect(personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung).toHaveBeenCalled();
            });
        });

        describe('when removing organisations fails', () => {
            it('should return false when at least one organisation removal fails', async () => {
                const today: Date = new Date();
                const daysAgo: Date = new Date(today.setDate(today.getDate() - 1));
                const person1: Person<true> = DoFactory.createPerson(true);
                const person2: Person<true> = DoFactory.createPerson(true);
                const person3: Person<true> = DoFactory.createPerson(true);

                const personenKontextMock1: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person1.id,
                });
                const personenKontextMock2: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person2.id,
                });
                const personenKontextMock3: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: daysAgo,
                    personId: person3.id,
                });
                const personenKontextMock4: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: today,
                    personId: person1.id,
                });
                const personenKontextMock5: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    befristung: today,
                    personId: person2.id,
                });

                const mockPersonenKontexte: Record<string, Personenkontext<true>[]> = {
                    [person1.id]: [personenKontextMock1, personenKontextMock4],
                    [person2.id]: [personenKontextMock2, personenKontextMock5],
                    [person3.id]: [personenKontextMock3],
                };

                personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung.mockResolvedValueOnce(
                    mockPersonenKontexte,
                );

                const mockResult: Personenkontext<true>[] = [personenKontextMock1, personenKontextMock4];
                const updateError: PersonenkontexteUpdateError = new PersonenkontexteUpdateError(
                    'Update error message',
                );
                personenkontextWorkflowMock.commit.mockResolvedValueOnce(mockResult);
                personenkontextWorkflowMock.commit.mockResolvedValueOnce(mockResult);
                personenkontextWorkflowMock.commit.mockResolvedValueOnce(updateError);
                personenkontextWorkflowFactoryMock.createNew.mockReturnValue(personenkontextWorkflowMock);

                const result: boolean =
                    await cronController.removePersonenKontexteWithExceedingLimitFromUsers(permissionsMock);

                expect(result).toBe(false); // Expect false since at least one removal failed
                expect(personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung).toHaveBeenCalled();
                expect(personenkontextWorkflowFactoryMock.createNew).toHaveBeenCalledTimes(3); // Ensure createNew was called three times
                expect(personenkontextWorkflowMock.commit).toHaveBeenCalledTimes(3); // Ensure commit is called three times
            });
        });

        describe('when an exception is thrown', () => {
            it('should throw an error when there is an internal server error', async () => {
                personenKontextRepositoryMock.getPersonenKontexteWithExceedingBefristung.mockImplementationOnce(() => {
                    throw new Error('Some internal error');
                });

                await expect(
                    cronController.removePersonenKontexteWithExceedingLimitFromUsers(permissionsMock),
                ).rejects.toThrow('Failed to remove kontexte due to an internal server error.');
            });
        });
    });
});
