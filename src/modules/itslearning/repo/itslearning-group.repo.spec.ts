import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggingTestModule } from '../../../../test/utils/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import { CreateGroupAction } from '../actions/create-group.action.js';
import { CreateGroupParams } from '../actions/create-group.params.js';
import { DeleteGroupAction } from '../actions/delete-group.action.js';
import { GroupResponse, ReadGroupAction } from '../actions/read-group.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { ItslearningGroupRepo } from './itslearning-group.repo.js';
import { CreateGroupsAction } from '../actions/create-groups.action.js';

describe('Itslearning Group Repo', () => {
    let module: TestingModule;

    let sut: ItslearningGroupRepo;
    let itsLearningServiceMock: DeepMocked<ItsLearningIMSESService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule],
            providers: [
                ItslearningGroupRepo,
                {
                    provide: ItsLearningIMSESService,
                    useValue: createMock<ItsLearningIMSESService>(),
                },
            ],
        }).compile();

        sut = module.get(ItslearningGroupRepo);
        itsLearningServiceMock = module.get(ItsLearningIMSESService);
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await module.close();
    });

    describe('readGroup', () => {
        it('should call the itslearning API', async () => {
            const organisationId: string = faker.string.uuid();

            await sut.readGroup(organisationId);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ id: organisationId }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(ReadGroupAction));
        });

        it('should return the result', async () => {
            const groupResponse: GroupResponse = {
                name: faker.word.noun(),
                parentId: faker.string.uuid(),
                type: 'Unspecified',
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: groupResponse,
            });

            const result: Option<GroupResponse> = await sut.readGroup(faker.string.uuid());

            expect(result).toEqual(groupResponse);
        });

        it('should return undefined, if the group could not be found', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock(),
            });

            const result: Option<GroupResponse> = await sut.readGroup(faker.string.uuid());

            expect(result).toBeUndefined();
        });
    });

    describe('createOrUpdateGroup', () => {
        it('should call the itslearning API', async () => {
            const createParams: CreateGroupParams = {
                id: faker.string.uuid(),
                name: faker.word.noun(),
                parentId: faker.string.uuid(),
                type: 'Unspecified',
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createOrUpdateGroup(createParams);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ params: createParams }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(CreateGroupAction));
        });

        it('should not return error on success', async () => {
            const createParams: CreateGroupParams = {
                id: faker.string.uuid(),
                name: faker.word.noun(),
                parentId: faker.string.uuid(),
                type: 'Unspecified',
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            const result: Option<DomainError> = await sut.createOrUpdateGroup(createParams);

            expect(result).toBeUndefined();
        });

        it('should return error, if the request failed', async () => {
            const createParams: CreateGroupParams = {
                id: faker.string.uuid(),
                name: faker.word.noun(),
                parentId: faker.string.uuid(),
                type: 'Unspecified',
            };
            const error: DomainError = new ItsLearningError('Test Error');
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: error,
            });

            const result: Option<DomainError> = await sut.createOrUpdateGroup(createParams);

            expect(result).toBe(error);
        });
    });

    describe('createOrUpdateGroups', () => {
        it('should call the itslearning API', async () => {
            const createParams: CreateGroupParams[] = [
                {
                    id: faker.string.uuid(),
                    name: faker.word.noun(),
                    parentId: faker.string.uuid(),
                    type: 'Unspecified',
                },
            ];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createOrUpdateGroups(createParams);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ params: createParams }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(CreateGroupsAction));
        });

        it('should not return error on success', async () => {
            const createParams: CreateGroupParams[] = [
                {
                    id: faker.string.uuid(),
                    name: faker.word.noun(),
                    parentId: faker.string.uuid(),
                    type: 'Unspecified',
                },
            ];
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            const result: Option<DomainError> = await sut.createOrUpdateGroups(createParams);

            expect(result).toBeUndefined();
        });

        it('should return error, if the request failed', async () => {
            const createParams: CreateGroupParams[] = [
                {
                    id: faker.string.uuid(),
                    name: faker.word.noun(),
                    parentId: faker.string.uuid(),
                    type: 'Unspecified',
                },
            ];
            const error: DomainError = new ItsLearningError('Test Error');
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: error,
            });

            const result: Option<DomainError> = await sut.createOrUpdateGroups(createParams);

            expect(result).toBe(error);
        });
    });

    describe('deleteGroup', () => {
        it('should call the itslearning API', async () => {
            const organisationId: string = faker.string.uuid();
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // DeletePersonAction

            await sut.deleteGroup(organisationId);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ id: organisationId }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(DeleteGroupAction));
        });

        it('should not return error on success', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            const result: Option<DomainError> = await sut.deleteGroup(faker.string.uuid());

            expect(result).toBeUndefined();
        });

        it('should return the error, if the request failed', async () => {
            const error: DomainError = new ItsLearningError('Test Error');

            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: error,
            });

            const result: Option<DomainError> = await sut.deleteGroup(faker.string.uuid());

            expect(result).toBe(error);
        });
    });
});
