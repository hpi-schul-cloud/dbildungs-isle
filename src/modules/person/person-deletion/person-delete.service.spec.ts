import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { PersonDeleteService } from './person-delete.service.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DomainError } from '../../../shared/error/index.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';

describe('PersonDeleteService', () => {
    let module: TestingModule;
    let sut: PersonDeleteService;

    let loggerMock: DeepMocked<ClassLogger>;
    let personenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonDeleteService,
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
        }).compile();

        sut = module.get(PersonDeleteService);
        loggerMock = module.get(ClassLogger);
        personenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('deletePerson', () => {
        describe('when error during loading of personenkontexte', () => {
            it('should log error', async () => {
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([createMock<Personenkontext<true>>()]);

                const res: Result<void, DomainError> = await sut.deletePerson(
                    faker.string.uuid(),
                    createMock<PersonPermissions>(),
                );

                expect(res.ok).toBeFalsy();
                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Error while loading Kontexts of person to delete'),
                );
            });
        });

        describe('when referenced rolle cannot be loaded for any PK', () => {
            it('should log error', async () => {
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([
                    createMock<Personenkontext<true>>({
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async getRolle(): Promise<Option<Rolle<true>>> {
                            return undefined;
                        },
                    }),
                ]);

                const res: Result<void, DomainError> = await sut.deletePerson(
                    faker.string.uuid(),
                    createMock<PersonPermissions>({}),
                );

                expect(res.ok).toBeFalsy();
                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Error while loading Kontexts of person to delete'),
                );
            });
        });

        describe('when gettin referenced rolle for PK is resulting in rejection of promise', () => {
            it('should log error', async () => {
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([
                    createMock<Personenkontext<true>>({
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async getRolle(): Promise<Option<Rolle<true>>> {
                            return Promise.reject('reason');
                        },
                    }),
                ]);

                const res: Result<void, DomainError> = await sut.deletePerson(
                    faker.string.uuid(),
                    createMock<PersonPermissions>({}),
                );

                expect(res.ok).toBeFalsy();
                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining('Error while loading Kontexts of person to delete'),
                );
            });
        });

        describe('when no error during loading of personenkontexte', () => {
            it('should log error', async () => {
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([
                    createMock<Personenkontext<true>>({
                        // eslint-disable-next-line @typescript-eslint/require-await
                        async getRolle(): Promise<Option<Rolle<true>>> {
                            return DoFactory.createRolle(true, {
                                serviceProviderData: [DoFactory.createServiceProvider(true)],
                            });
                        },
                    }),
                ]);

                // personRepositoryMock.deletePerson.mockResolvedValueOnce();

                const res: Result<void, DomainError> = await sut.deletePerson(
                    faker.string.uuid(),
                    createMock<PersonPermissions>({}),
                );

                expect(res.ok).toBeTruthy();
                expect(loggerMock.error).toHaveBeenCalledTimes(0);
            });
        });
    });
});
