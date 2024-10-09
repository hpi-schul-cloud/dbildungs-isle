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
                userId: faker.string.uuid(),
                institutionRole: faker.helpers.enumValue(IMSESInstitutionRoleType),
                primaryRoleType: true,
            };
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: personResponse,
            });

            const result: Option<PersonResponse> = await sut.readPerson(personResponse.userId);

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

    describe('createOrUpdatePerson', () => {
        it('should call the itslearning API', async () => {
            const createParams: CreatePersonParams = {
                id: faker.string.uuid(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                username: faker.internet.userName(),
                institutionRoleType: faker.helpers.enumValue(IMSESInstitutionRoleType),
            };

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
