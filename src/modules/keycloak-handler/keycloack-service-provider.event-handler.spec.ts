import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { KeycloackServiceProviderHandler } from './keycloack-service-provider.event-handler.js';
import { KeycloakUserService } from '../keycloak-administration/index.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
    PersonenkontextUpdatedPersonData,
} from '../../shared/events/personenkontext-updated.event.js';
import { RolleID } from '../../shared/types/aggregate-ids.types.js';
import { faker } from '@faker-js/faker';
import { RolleRepo } from '../rolle/repo/rolle.repo.js';
import { Rolle } from '../rolle/domain/rolle.js';

describe('KeycloackServiceProviderHandler', () => {
    let module: TestingModule;
    let sut: KeycloackServiceProviderHandler;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let keycloakUserServiceMock: DeepMocked<KeycloakUserService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                KeycloackServiceProviderHandler,
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
            ],
        }).compile();

        sut = module.get(KeycloackServiceProviderHandler);
        rolleRepoMock = module.get(RolleRepo);
        keycloakUserServiceMock = module.get(KeycloakUserService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should update user roles when new roles are added', async () => {
        // Arrange
        const keycloakUserIdNew: string = faker.string.uuid();
        const keycloakUserIdCurrent: string = faker.string.uuid();
        const personenkontextUpdatedEventMock: DeepMocked<PersonenkontextUpdatedEvent> =
            createMock<PersonenkontextUpdatedEvent>({
                person: {
                    keycloakUserId: faker.string.uuid(),
                } as PersonenkontextUpdatedPersonData,
                newKontexte: [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
                removedKontexte: [],
                currentKontexte: [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
            });

        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([
                [faker.string.uuid(), { serviceProviderData: [{ keycloakRole: keycloakUserIdNew }] } as Rolle<true>],
            ]),
        );
        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([
                [
                    faker.string.uuid(),
                    { serviceProviderData: [{ keycloakRole: keycloakUserIdCurrent }] } as Rolle<true>,
                ],
            ]),
        );

        // Act
        await sut.handlePersonenkontextUpdatedEvent(personenkontextUpdatedEventMock);

        // Assert
        expect(keycloakUserServiceMock.assignRealmGroupsToUser).toHaveBeenCalledWith(
            personenkontextUpdatedEventMock.person.keycloakUserId,
            [keycloakUserIdNew],
        );
        expect(keycloakUserServiceMock.removeRealmGroupsFromUser).not.toHaveBeenCalled();
    });

    it('should remove user roles when roles are removed', async () => {
        // Arrange
        const keycloakUserIdDelete: string = faker.string.uuid();
        const keycloakUserIdCurrent: string = faker.string.uuid();
        const personenkontextUpdatedEvent: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
            {
                keycloakUserId: faker.string.uuid(),
            } as PersonenkontextUpdatedPersonData,
            [],
            [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
            [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
        );

        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([
                [faker.string.uuid(), { serviceProviderData: [{ keycloakRole: keycloakUserIdDelete }] } as Rolle<true>],
            ]),
        );
        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([
                [
                    faker.string.uuid(),
                    { serviceProviderData: [{ keycloakRole: keycloakUserIdCurrent }] } as Rolle<true>,
                ],
            ]),
        );

        // Act
        await sut.handlePersonenkontextUpdatedEvent(personenkontextUpdatedEvent);

        // Assert
        expect(keycloakUserServiceMock.removeRealmGroupsFromUser).toHaveBeenCalledWith(
            personenkontextUpdatedEvent.person.keycloakUserId,
            [keycloakUserIdDelete],
        );
        expect(keycloakUserServiceMock.assignRealmGroupsToUser).not.toHaveBeenCalled();
    });

    it('should not update roles if no Keycloak user ID is present', async () => {
        // Arrange
        const personenkontextUpdatedEvent: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
            {
                keycloakUserId: undefined,
            } as PersonenkontextUpdatedPersonData,
            [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
            [],
            [{ rolleId: faker.string.uuid() } as PersonenkontextUpdatedData],
        );

        // Act
        await sut.handlePersonenkontextUpdatedEvent(personenkontextUpdatedEvent);

        // Assert
        expect(rolleRepoMock.findByIds).not.toHaveBeenCalled();
        expect(keycloakUserServiceMock.assignRealmGroupsToUser).not.toHaveBeenCalled();
        expect(keycloakUserServiceMock.removeRealmGroupsFromUser).not.toHaveBeenCalled();
    });
    it('should return the correct currentRolleIDs', async () => {
        // Arrange
        const rolleID: string = faker.string.uuid();
        const rollID2: string = faker.string.uuid();
        const keycloakUserId: string = faker.string.uuid();
        const personenkontextUpdatedEvent: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
            {
                keycloakUserId: keycloakUserId,
            } as PersonenkontextUpdatedPersonData,
            [{ rolleId: rolleID } as PersonenkontextUpdatedData],
            [],
            [{ rolleId: rolleID }, { rolleId: rollID2 }] as PersonenkontextUpdatedData[],
        );

        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([
                [faker.string.uuid(), { serviceProviderData: [{ keycloakRole: keycloakUserId }] } as Rolle<true>],
            ]),
        );
        rolleRepoMock.findByIds.mockResolvedValueOnce(
            new Map([[faker.string.uuid(), { serviceProviderData: [{ keycloakRole: 'delete' }] } as Rolle<true>]]),
        );

        const newRolle: RolleID | undefined = personenkontextUpdatedEvent.newKontexte?.[0]?.rolleId;
        const currentRolleIDs: RolleID[] =
            personenkontextUpdatedEvent.currentKontexte
                ?.map((kontext: PersonenkontextUpdatedData) => kontext.rolleId)
                .filter((id: RolleID) => id && id !== newRolle) || [];

        // Act
        await sut.handlePersonenkontextUpdatedEvent(personenkontextUpdatedEvent);

        // Assert
        expect(currentRolleIDs).toEqual([rollID2]);
    });
});
