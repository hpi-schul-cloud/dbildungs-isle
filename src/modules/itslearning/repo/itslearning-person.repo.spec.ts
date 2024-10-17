import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggingTestModule } from '../../../../test/utils/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import { CreatePersonAction, CreatePersonParams } from '../actions/create-person.action.js';
import { DeletePersonAction } from '../actions/delete-person.action.js';
import { PersonResponse, ReadPersonAction } from '../actions/read-person.action.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { IMSESInstitutionRoleType } from '../types/role.enum.js';
import { ItslearningPersonRepo } from './itslearning-person.repo.js';

describe('Itslearning Person Repo', () => {
    let module: TestingModule;

    let sut: ItslearningPersonRepo;
    let itsLearningServiceMock: DeepMocked<ItsLearningIMSESService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule],
            providers: [
                ItslearningPersonRepo,
                {
                    provide: ItsLearningIMSESService,
                    useValue: createMock<ItsLearningIMSESService>(),
                },
            ],
        }).compile();

        sut = module.get(ItslearningPersonRepo);
        itsLearningServiceMock = module.get(ItsLearningIMSESService);
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await module.close();
    });

    describe('readPerson', () => {
        it('should call the itslearning API', async () => {
            const personId: string = faker.string.uuid();

            await sut.readPerson(personId);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ id: personId }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(ReadPersonAction));
        });

        it('should return the result', async () => {
            const personResponse: PersonResponse = {
                username: faker.string.uuid(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                institutionRole: faker.helpers.enumValue(IMSESInstitutionRoleType),
                primaryRoleType: true,
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: personResponse,
            });

            const result: Option<PersonResponse> = await sut.readPerson(personResponse.username);

            expect(result).toEqual(personResponse);
        });

        it('should return undefined, if the person could not be found', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock(),
            });

            const result: Option<PersonResponse> = await sut.readPerson(faker.string.uuid());

            expect(result).toBeUndefined();
        });
    });

    describe('updateEmail', () => {
        it('should call itslearning', async () => {
            const personId: string = faker.string.uuid();
            const email: string = faker.internet.email();
            const personResponse: PersonResponse = {
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.userName(),
                institutionRole: faker.helpers.enumValue(IMSESInstitutionRoleType),
                primaryRoleType: true,
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: personResponse,
            }); // ReadPersonAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreatePersonAction

            await sut.updateEmail(personId, email);

            expect(itsLearningServiceMock.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: personId }));
            expect(itsLearningServiceMock.send).toHaveBeenNthCalledWith(1, expect.any(ReadPersonAction));
            expect(itsLearningServiceMock.send).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    params: {
                        id: personId,
                        firstName: personResponse.firstName,
                        lastName: personResponse.lastName,
                        username: personResponse.username,
                        institutionRoleType: personResponse.institutionRole,
                        email,
                    },
                }),
            );
            expect(itsLearningServiceMock.send).toHaveBeenNthCalledWith(2, expect.any(CreatePersonAction));
        });

        it('should not update email, if person was not found', async () => {
            const personId: string = faker.string.uuid();
            const email: string = faker.internet.email();
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: new ItsLearningError('Not Found'),
            }); // ReadPersonAction

            await sut.updateEmail(personId, email);

            expect(itsLearningServiceMock.send).toHaveBeenCalledTimes(1);
            expect(itsLearningServiceMock.send).not.toHaveBeenCalledWith(expect.any(CreatePersonAction));
        });
    });

    describe('createOrUpdatePerson', () => {
        it('should call the itslearning API', async () => {
            const createParams: CreatePersonParams = {
                id: faker.string.uuid(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.userName(),
                institutionRoleType: faker.helpers.enumValue(IMSESInstitutionRoleType),
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreatePersonAction

            await sut.createOrUpdatePerson(createParams);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ params: createParams }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(CreatePersonAction));
        });

        it('should not return error on success', async () => {
            const createParams: CreatePersonParams = {
                id: faker.string.uuid(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.userName(),
                institutionRoleType: faker.helpers.enumValue(IMSESInstitutionRoleType),
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            const result: Option<DomainError> = await sut.createOrUpdatePerson(createParams);

            expect(result).toBeUndefined();
        });

        it('should return error, if the request failed', async () => {
            const createParams: CreatePersonParams = {
                id: faker.string.uuid(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.userName(),
                institutionRoleType: faker.helpers.enumValue(IMSESInstitutionRoleType),
            };
            const error: DomainError = new ItsLearningError('Test Error');
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: error,
            });

            const result: Option<DomainError> = await sut.createOrUpdatePerson(createParams);

            expect(result).toBe(error);
        });
    });

    describe('deletePerson', () => {
        it('should call the itslearning API', async () => {
            const personId: string = faker.string.uuid();
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // DeletePersonAction

            await sut.deletePerson(personId);

            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.objectContaining({ id: personId }));
            expect(itsLearningServiceMock.send).toHaveBeenCalledWith(expect.any(DeletePersonAction));
        });

        it('should not return error on success', async () => {
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            const result: Option<DomainError> = await sut.deletePerson(faker.string.uuid());

            expect(result).toBeUndefined();
        });

        it('should return the error, if the request failed', async () => {
            const error: DomainError = new ItsLearningError('Test Error');

            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: error,
            });

            const result: Option<DomainError> = await sut.deletePerson(faker.string.uuid());

            expect(result).toBe(error);
        });
    });
});
