import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
    PersonenkontextUpdatedPersonData,
} from '../../../shared/events/personenkontext-updated.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { ServiceProviderSystem } from '../../service-provider/domain/service-provider.enum.js';
import { CreateMembershipsAction } from '../actions/create-memberships.action.js';
import { CreatePersonAction } from '../actions/create-person.action.js';
import { DeleteMembershipsAction } from '../actions/delete-memberships.action.js';
import { DeletePersonAction } from '../actions/delete-person.action.js';
import { MembershipResponse } from '../actions/read-memberships-for-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { IMSESInstitutionRoleType, IMSESRoleType } from '../types/role.enum.js';
import { ItsLearningPersonsEventHandler } from './itslearning-persons.event-handler.js';

function makeKontextEventData(props?: Partial<PersonenkontextUpdatedData> | undefined): PersonenkontextUpdatedData {
    return {
        id: props?.id ?? faker.string.uuid(),
        orgaId: props?.orgaId ?? faker.string.uuid(),
        rolle: props?.rolle ?? faker.helpers.enumValue(RollenArt),
        rolleId: props?.rolleId ?? faker.string.uuid(),
        serviceProviderExternalSystems: props?.serviceProviderExternalSystems ?? [ServiceProviderSystem.ITSLEARNING],
    };
}

describe('ItsLearning Persons Event Handler', () => {
    let module: TestingModule;

    let sut: ItsLearningPersonsEventHandler;
    let itsLearningServiceMock: DeepMocked<ItsLearningIMSESService>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                ItsLearningPersonsEventHandler,
                {
                    provide: ItsLearningIMSESService,
                    useValue: createMock<ItsLearningIMSESService>(),
                },
            ],
        }).compile();

        sut = module.get(ItsLearningPersonsEventHandler);
        itsLearningServiceMock = module.get(ItsLearningIMSESService);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        sut.ENABLED = true;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('updateMemberships', () => {
        describe('when kontexte were removed', () => {
            it('general', async () => {
                const personId: string = faker.string.uuid();
                const currentKontexte: PersonenkontextUpdatedData[] = [];
                const removedKontexte: PersonenkontextUpdatedData[] = [];
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: [],
                } satisfies Result<MembershipResponse[]>); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                } satisfies Result<void>); // DeleteMembershipsAction
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                } satisfies Result<void>); // CreateMembershipsAction

                await sut.updateMemberships(personId, currentKontexte, removedKontexte);
            });
        });

        describe('adding/updating memberships', () => {
            it('should update all memberships we know of', async () => {
                const personId: string = faker.string.uuid();
                const currentKontexte: PersonenkontextUpdatedData[] = [makeKontextEventData(), makeKontextEventData()];
                const removedKontexte: PersonenkontextUpdatedData[] = [];
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: [],
                } satisfies Result<MembershipResponse[]>); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                } satisfies Result<void>); // CreateMembershipsAction

                await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                expect(loggerMock.info).toHaveBeenCalledWith(`Created/Updated 2 memberships for person ${personId}`);
            });

            it('should combine personenkontexte at one organisation into one membership', async () => {
                const personId: string = faker.string.uuid();
                const orgaId: string = faker.string.uuid();
                const currentKontexte: PersonenkontextUpdatedData[] = [
                    makeKontextEventData({ orgaId, rolle: RollenArt.LEHR }),
                    makeKontextEventData({ orgaId, rolle: RollenArt.LEIT }),
                ];
                const removedKontexte: PersonenkontextUpdatedData[] = [];
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: [],
                } satisfies Result<MembershipResponse[]>); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                } satisfies Result<void>); // CreateMembershipsAction

                await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                expect(loggerMock.info).toHaveBeenCalledWith(`Created/Updated 1 memberships for person ${personId}`);
            });

            describe('when creating/updating failed', () => {
                it('should log error', async () => {
                    const personId: string = faker.string.uuid();
                    const kontext: PersonenkontextUpdatedData = makeKontextEventData();
                    const currentKontexte: PersonenkontextUpdatedData[] = [kontext];
                    const removedKontexte: PersonenkontextUpdatedData[] = [];
                    const error: DomainError = new ItsLearningError('CreateMembershipsAction Error');
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: true,
                        value: [{ groupId: kontext.orgaId, id: kontext.id, role: IMSESRoleType.INSTRUCTOR }],
                    } satisfies Result<MembershipResponse[]>); // Read Memberships
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: false,
                        error,
                    } satisfies Result<void>); // CreateMembershipsAction

                    await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                    expect(loggerMock.error).toHaveBeenCalledWith(
                        `Could not create/update 1 memberships for person ${personId}`,
                        error,
                    );
                });
            });

            describe('when person has no kontexte', () => {
                it('should not send create/update request', async () => {
                    const personId: string = faker.string.uuid();
                    const currentKontexte: PersonenkontextUpdatedData[] = [];
                    const removedKontexte: PersonenkontextUpdatedData[] = [];
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: true,
                        value: [],
                    } satisfies Result<MembershipResponse[]>); // Read Memberships

                    await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                    expect(itsLearningServiceMock.send).not.toHaveBeenCalledWith(expect.any(CreateMembershipsAction));
                });
            });
        });

        describe('deleting memberships', () => {
            it('should only delete memberships that are in itslearning', async () => {
                const personId: string = faker.string.uuid();
                const kontext: PersonenkontextUpdatedData = makeKontextEventData();
                const currentKontexte: PersonenkontextUpdatedData[] = [];
                const removedKontexte: PersonenkontextUpdatedData[] = [kontext, makeKontextEventData()];
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: [{ groupId: kontext.orgaId, id: kontext.id, role: IMSESRoleType.INSTRUCTOR }],
                } satisfies Result<MembershipResponse[]>); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                } satisfies Result<void>); // DeleteMembershipsAction

                await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                expect(loggerMock.info).toHaveBeenCalledWith(`Deleted 1 memberships for person ${personId}`);
            });

            describe('when deleting failed', () => {
                it('should log error', async () => {
                    const personId: string = faker.string.uuid();
                    const kontext: PersonenkontextUpdatedData = makeKontextEventData();
                    const currentKontexte: PersonenkontextUpdatedData[] = [];
                    const removedKontexte: PersonenkontextUpdatedData[] = [kontext];
                    const error: DomainError = new ItsLearningError('DeleteMembershipsAction Error');
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: true,
                        value: [{ groupId: kontext.orgaId, id: kontext.id, role: IMSESRoleType.INSTRUCTOR }],
                    } satisfies Result<MembershipResponse[]>); // Read Memberships
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: false,
                        error,
                    } satisfies Result<void>); // DeleteMembershipsAction

                    await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                    expect(loggerMock.error).toHaveBeenCalledWith(
                        `Could not delete 1 memberships for person ${personId}`,
                        error,
                    );
                });
            });

            describe('when person has no memberships but kontexte were removed', () => {
                it('should not send delete request', async () => {
                    const personId: string = faker.string.uuid();
                    const currentKontexte: PersonenkontextUpdatedData[] = [];
                    const removedKontexte: PersonenkontextUpdatedData[] = [makeKontextEventData()];
                    itsLearningServiceMock.send.mockResolvedValueOnce({
                        ok: true,
                        value: [],
                    } satisfies Result<MembershipResponse[]>); // Read Memberships

                    await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                    expect(itsLearningServiceMock.send).not.toHaveBeenCalledWith(expect.any(DeleteMembershipsAction));
                });
            });
        });

        describe('when no memberships could be retrieved', () => {
            it('should log error and return', async () => {
                const personId: string = faker.string.uuid();
                const currentKontexte: PersonenkontextUpdatedData[] = [];
                const removedKontexte: PersonenkontextUpdatedData[] = [];
                const error: DomainError = new ItsLearningError('ReadMembershipsForPersonAction Error');
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error,
                } satisfies Result<MembershipResponse[]>); // Read Memberships

                await sut.updateMemberships(personId, currentKontexte, removedKontexte);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not retrieve memberships for ${personId}, the user might not exist.`,
                    error,
                );
                expect(itsLearningServiceMock.send).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('deletePerson', () => {
        it('should delete person in itsLearning', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: undefined });

            await sut.deletePerson(faker.string.uuid());

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(DeletePersonAction));
        });

        it('should log error if person could not be deleted', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: createMock() });
            const personID: string = faker.string.uuid();

            await sut.deletePerson(personID);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `Could not delete person with ID ${personID} from itsLearning.`,
            );
        });
    });

    describe('updatePerson', () => {
        const person: PersonenkontextUpdatedPersonData = {
            id: faker.string.uuid(),
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            referrer: faker.internet.userName(),
        };

        it('should send person to itsLearning', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock(),
            }); // Read person
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // Send person

            await sut.updatePerson(person, [createMock()]);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(CreatePersonAction));
        });

        it('should log error if person could not be created', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock(),
            });
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: createMock() });

            await sut.updatePerson(person, [createMock()]);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `Person with ID ${person.id} could not be sent to itsLearning!`,
            );
        });

        describe('when person is invalid', () => {
            it('should log error, if person has no referrer', async () => {
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: createMock(),
                });

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { referrer, ...personWithoutReferrer }: PersonenkontextUpdatedPersonData = person;

                await sut.updatePerson(personWithoutReferrer, [createMock()]);

                expect(loggerMock.error).toHaveBeenCalledWith(`Person with ID ${person.id} has no username!`);
            });
        });

        describe('when person with correct role already exists', () => {
            it('should skip creation', async () => {
                itsLearningServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: { institutionRole: IMSESInstitutionRoleType.STAFF },
                });

                await sut.updatePerson(person, [createMock<PersonenkontextUpdatedData>({ rolle: RollenArt.LEHR })]);

                expect(loggerMock.info).toHaveBeenCalledWith('Person already exists with correct role');
            });
        });
    });

    describe('updatePersonenkontexteEventHandler', () => {
        it('should not throw', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [],
            );

            jest.spyOn(sut, 'updatePerson').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'updateMemberships').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'deletePerson').mockResolvedValueOnce(undefined);

            await sut.updatePersonenkontexteEventHandler(event);
        });

        it('should call updatePerson, if at least one relevant kontext exists', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [makeKontextEventData({ serviceProviderExternalSystems: [ServiceProviderSystem.ITSLEARNING] })],
            );

            const updatePersonSpy: jest.SpyInstance = jest.spyOn(sut, 'updatePerson').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'updateMemberships').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'deletePerson').mockResolvedValueOnce(undefined);

            await sut.updatePersonenkontexteEventHandler(event);

            expect(updatePersonSpy).toHaveBeenCalledTimes(1);
        });

        it('should not call updatePerson, if no relevant kontext exists', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [makeKontextEventData({ serviceProviderExternalSystems: [ServiceProviderSystem.NONE] })],
            );

            const updatePersonSpy: jest.SpyInstance = jest.spyOn(sut, 'updatePerson').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'updateMemberships').mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'deletePerson').mockResolvedValueOnce(undefined);

            await sut.updatePersonenkontexteEventHandler(event);

            expect(updatePersonSpy).toHaveBeenCalledTimes(0);
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [],
            );

            await sut.updatePersonenkontexteEventHandler(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event.');
        });
    });
});
