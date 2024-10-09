import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import { CreateMembershipParams, CreateMembershipsAction } from '../actions/create-memberships.action.js';
import { MembershipResponse, ReadMembershipsForPersonAction } from '../actions/read-memberships-for-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { IMSESRoleType } from '../types/role.enum.js';
import { ItslearningMembershipRepo, SetMembershipParams, SetMembershipsResult } from './itslearning-membership.repo.js';
import { DeleteMembershipsAction } from '../actions/delete-memberships.action.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';

describe('Itslearning Person Repo', () => {
    let module: TestingModule;

    let sut: ItslearningMembershipRepo;
    let itsLearningServiceMock: DeepMocked<ItsLearningIMSESService>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, LoggingTestModule],
            providers: [
                ItslearningMembershipRepo,
                {
                    provide: ItsLearningIMSESService,
                    useValue: createMock<ItsLearningIMSESService>(),
                },
            ],
        }).compile();

        sut = module.get(ItslearningMembershipRepo);
        itsLearningServiceMock = module.get(ItsLearningIMSESService);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    describe('readMembershipsForPerson', () => {
        it('should call the itslearning API', async () => {
            const personId: string = faker.string.uuid();

            await sut.readMembershipsForPerson(personId);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ personId }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(ReadMembershipsForPersonAction));
        });

        it('should return the result', async () => {
            const membershipResponse: MembershipResponse[] = [
                {
                    id: faker.string.uuid(),
                    groupId: faker.string.uuid(),
                    role: faker.helpers.enumValue(IMSESRoleType),
                },
            ];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: membershipResponse,
            });

            const result: Result<MembershipResponse[], DomainError> = await sut.readMembershipsForPerson(
                faker.string.uuid(),
            );

            expect(result).toEqual({ ok: true, value: membershipResponse });
        });
    });

    describe('createMemberships', () => {
        it('should call the itslearning API', async () => {
            const memberships: CreateMembershipParams[] = [
                {
                    id: faker.string.uuid(),
                    personId: faker.string.uuid(),
                    groupId: faker.string.uuid(),
                    roleType: faker.helpers.enumValue(IMSESRoleType),
                },
            ];

            await sut.createMemberships(memberships);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ params: memberships }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(CreateMembershipsAction));
        });

        it('should not return error on success', async () => {
            const memberships: CreateMembershipParams[] = [
                {
                    id: faker.string.uuid(),
                    personId: faker.string.uuid(),
                    groupId: faker.string.uuid(),
                    roleType: faker.helpers.enumValue(IMSESRoleType),
                },
            ];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            const result: Option<DomainError> = await sut.createMemberships(memberships);

            expect(result).toBeUndefined();
        });

        it('should return error on fail', async () => {
            const error: DomainError = new ItsLearningError('Test Error');
            const memberships: CreateMembershipParams[] = [
                {
                    id: faker.string.uuid(),
                    personId: faker.string.uuid(),
                    groupId: faker.string.uuid(),
                    roleType: faker.helpers.enumValue(IMSESRoleType),
                },
            ];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error,
            });

            const result: Option<DomainError> = await sut.createMemberships(memberships);

            expect(result).toBe(error);
        });
    });

    describe('removeMemberships', () => {
        it('should call the itslearning API', async () => {
            const membershipIDs: string[] = [faker.string.uuid()];

            await sut.removeMemberships(membershipIDs);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ membershipIDs }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(DeleteMembershipsAction));
        });

        it('should not return error on success', async () => {
            const membershipIDs: string[] = [faker.string.uuid()];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            const result: Option<DomainError> = await sut.removeMemberships(membershipIDs);

            expect(result).toBeUndefined();
        });

        it('should return error on fail', async () => {
            const error: DomainError = new ItsLearningError('Test Error');
            const membershipIDs: string[] = [faker.string.uuid()];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error,
            });

            const result: Option<DomainError> = await sut.removeMemberships(membershipIDs);

            expect(result).toBe(error);
        });
    });

    describe('setMemberships', () => {
        describe('reading current memberships', () => {
            it('should read current memberships for person', async () => {
                const personId: string = faker.string.uuid();
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: [] }); // Read Memberships

                await sut.setMemberships(personId, []);

                expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ personId }));
                expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(ReadMembershipsForPersonAction));
            });

            it('should abort if memberships can not be read', async () => {
                const error: DomainError = new ItsLearningError('Error Test');
                const personId: string = faker.string.uuid();
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error });

                const result: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(personId, []);

                expect(result).toEqual({ ok: false, error });
            });
        });

        describe('removing unneeded memberships', () => {
            it("should remove memberships that we didn't set", async () => {
                const personId: string = faker.string.uuid();
                const existingMemberships: MembershipResponse[] = [
                    { id: 'test', groupId: 'test-group', role: faker.helpers.enumValue(IMSESRoleType) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: existingMemberships }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: undefined }); // Remove Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(personId, []);

                expect(setResult).toEqual({ ok: true, value: { updated: 0, deleted: 1 } });
            });

            it('should try to remove the root memberships', async () => {
                const personId: string = faker.string.uuid();
                const existingMemberships: MembershipResponse[] = [
                    { id: 'sh-test', groupId: 'sh', role: faker.helpers.enumValue(IMSESRoleType) },
                    { id: 'oeffentlich-test', groupId: 'oeffentlich', role: faker.helpers.enumValue(IMSESRoleType) },
                    { id: 'ersatz-test', groupId: 'ersatz', role: faker.helpers.enumValue(IMSESRoleType) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: existingMemberships }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: undefined }); // Remove Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(personId, []);

                expect(setResult).toEqual({ ok: true, value: { updated: 3, deleted: 0 } });
            });

            it('should log error if memberships could not be removed', async () => {
                const error: DomainError = new ItsLearningError('Error Test');
                const personId: string = faker.string.uuid();
                const existingMemberships: MembershipResponse[] = [
                    { id: 'test', groupId: 'test-group', role: faker.helpers.enumValue(IMSESRoleType) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: existingMemberships }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: error }); // Remove Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(personId, []);

                expect(setResult).toEqual({ ok: true, value: { updated: 0, deleted: 0 } });
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not delete 1 memberships for person with ID ${personId}.`,
                    error,
                );
            });
        });

        describe('create/update memberships', () => {
            it('should create/update memberships', async () => {
                const personId: string = faker.string.uuid();
                const currentMemberships: SetMembershipParams[] = [
                    { organisationId: 'orga-test', role: faker.helpers.enumValue(RollenArt) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: [] }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: undefined }); // Create Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(
                    personId,
                    currentMemberships,
                );

                expect(setResult).toEqual({ ok: true, value: { updated: 1, deleted: 0 } });
            });

            it('should try to update the root memberships', async () => {
                const personId: string = faker.string.uuid();
                const existingMemberships: MembershipResponse[] = [
                    { id: 'sh-test', groupId: 'sh', role: faker.helpers.enumValue(IMSESRoleType) },
                    { id: 'oeffentlich-test', groupId: 'oeffentlich', role: faker.helpers.enumValue(IMSESRoleType) },
                    { id: 'ersatz-test', groupId: 'ersatz', role: faker.helpers.enumValue(IMSESRoleType) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: existingMemberships }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: undefined }); // Remove Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(personId, []);

                expect(setResult).toEqual({ ok: true, value: { updated: 3, deleted: 0 } });
            });

            it('should log error if memberships could not be removed', async () => {
                const error: DomainError = new ItsLearningError('Error Test');
                const personId: string = faker.string.uuid();
                const currentMemberships: SetMembershipParams[] = [
                    { organisationId: 'orga-test', role: faker.helpers.enumValue(RollenArt) },
                ];
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: [] }); // Read Memberships
                itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: error }); // Create Memberships

                const setResult: Result<SetMembershipsResult, DomainError> = await sut.setMemberships(
                    personId,
                    currentMemberships,
                );

                expect(setResult).toEqual({ ok: true, value: { updated: 0, deleted: 0 } });
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not create/update 1 memberships for person with ID ${personId}.`,
                    error,
                );
            });
        });
    });
});
