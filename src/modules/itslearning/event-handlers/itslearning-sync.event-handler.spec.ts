import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigTestModule, DoFactory, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import { PersonExternalSystemsSyncEvent } from '../../../shared/events/person-external-systems-sync.event.js';
import { Person } from '../../person/domain/person.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { ServiceProviderSystem } from '../../service-provider/domain/service-provider.enum.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { ItslearningMembershipRepo, SetMembershipsResult } from '../repo/itslearning-membership.repo.js';
import { ItslearningPersonRepo } from '../repo/itslearning-person.repo.js';
import { rollenartToIMSESInstitutionRole } from '../repo/role-utils.js';
import { ItsLearningSyncEventHandler } from './itslearning-sync.event-handler.js';

describe('ItsLearning Persons Event Handler', () => {
    let module: TestingModule;

    let sut: ItsLearningSyncEventHandler;
    let itslearningPersonRepoMock: DeepMocked<ItslearningPersonRepo>;
    let itslearningMembershipRepoMock: DeepMocked<ItslearningMembershipRepo>;
    let personRepoMock: DeepMocked<PersonRepository>;
    let personenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                ItsLearningSyncEventHandler,
                {
                    provide: ItslearningPersonRepo,
                    useValue: createMock<ItslearningPersonRepo>(),
                },
                {
                    provide: ItslearningMembershipRepo,
                    useValue: createMock<ItslearningMembershipRepo>(),
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
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
            ],
        }).compile();

        sut = module.get(ItsLearningSyncEventHandler);
        itslearningPersonRepoMock = module.get(ItslearningPersonRepo);
        itslearningMembershipRepoMock = module.get(ItslearningMembershipRepo);
        personRepoMock = module.get(PersonRepository);
        personenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        rolleRepoMock = module.get(RolleRepo);
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

    describe('personExternalSystemSyncEventHandler', () => {
        const person: Person<true> = DoFactory.createPerson(true, { referrer: faker.internet.userName() });

        const itslearningProvider: ServiceProvider<true> = DoFactory.createServiceProvider(true, {
            externalSystem: ServiceProviderSystem.ITSLEARNING,
        });

        const rolleWithItslearning: Rolle<true> = DoFactory.createRolle(true, {
            serviceProviderData: [itslearningProvider],
        });
        const rolleWithoutItslearning: Rolle<true> = DoFactory.createRolle(true);

        const personenkontextWithItslearning: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
            rolleId: rolleWithItslearning.id,
        });
        const personenkontextWithoutItslearning: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
            rolleId: rolleWithoutItslearning.id,
        });

        describe('when person has at least one relevant kontext', () => {
            beforeEach(() => {
                personRepoMock.findById.mockResolvedValueOnce(person);
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([
                    personenkontextWithItslearning,
                    personenkontextWithoutItslearning,
                ]);
                rolleRepoMock.findByIds.mockResolvedValueOnce(
                    new Map([
                        [rolleWithItslearning.id, rolleWithItslearning],
                        [rolleWithoutItslearning.id, rolleWithoutItslearning],
                    ]),
                );
            });

            it('should create or update user', async () => {
                itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(undefined);

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(itslearningPersonRepoMock.createOrUpdatePerson).toHaveBeenCalledWith({
                    id: person.id,
                    firstName: person.vorname,
                    lastName: person.familienname,
                    username: person.referrer,
                    institutionRoleType: rollenartToIMSESInstitutionRole(rolleWithItslearning.rollenart),
                });
                expect(loggerMock.info).toHaveBeenCalledWith(`Updated person with ID ${person.id} in itslearning!`);
            });

            it('should log error if creation failed', async () => {
                itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(
                    new ItsLearningError('Error Test'),
                );

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(itslearningPersonRepoMock.createOrUpdatePerson).toHaveBeenCalledTimes(1);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not create/update person with ID ${person.id} in itslearning!`,
                );
            });

            it('should set memberships', async () => {
                itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(undefined);
                itslearningMembershipRepoMock.setMemberships.mockResolvedValueOnce({
                    ok: true,
                    value: { deleted: 0, updated: 1 },
                } satisfies Result<SetMembershipsResult, DomainError>);

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(itslearningMembershipRepoMock.setMemberships).toHaveBeenCalledWith(
                    person.id,
                    expect.arrayContaining([
                        {
                            organisationId: personenkontextWithItslearning.organisationId,
                            role: rolleWithItslearning.rollenart,
                        },
                    ]),
                );
                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Created/Updated 1 and deleted 0 memberships for person with ID ${person.id} to itslearning!`,
                );
            });

            it('should log error if setting memberships failed', async () => {
                itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(undefined);
                itslearningMembershipRepoMock.setMemberships.mockResolvedValueOnce({
                    ok: false,
                    error: new ItsLearningError('Error Test'),
                } satisfies Result<SetMembershipsResult, DomainError>);

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not delete person with ID ${person.id} from itslearning!`,
                );
            });
        });

        describe('when person has no relevant kontext', () => {
            beforeEach(() => {
                personRepoMock.findById.mockResolvedValueOnce(person);
                personenkontextRepoMock.findByPerson.mockResolvedValueOnce([personenkontextWithoutItslearning]);
                rolleRepoMock.findByIds.mockResolvedValueOnce(
                    new Map([[rolleWithoutItslearning.id, rolleWithoutItslearning]]),
                );
            });

            it('should delete person', async () => {
                itslearningPersonRepoMock.deletePerson.mockResolvedValueOnce(undefined);

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(itslearningPersonRepoMock.deletePerson).toHaveBeenCalledWith(person.id);
            });

            it('should log error if deletion failed', async () => {
                itslearningPersonRepoMock.deletePerson.mockResolvedValueOnce(new ItsLearningError('Error Test'));

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(person.id));

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could not delete person with ID ${person.id} from itslearning!`,
                );
            });
        });

        describe('invalid person', () => {
            it("should log error, if person doesn't exist", async () => {
                const personId: string = faker.string.uuid();
                personRepoMock.findById.mockResolvedValueOnce(undefined);

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(personId));

                expect(loggerMock.error).toHaveBeenCalledWith(`Person with ID ${personId} could not be found!`);
            });

            it('should log error, if person has no username', async () => {
                const personId: string = faker.string.uuid();
                personRepoMock.findById.mockResolvedValueOnce(DoFactory.createPerson(true, { referrer: undefined }));

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(personId));

                expect(loggerMock.error).toHaveBeenCalledWith(`Person with ID ${personId} has no username!`);
            });
        });

        describe('when not enabled', () => {
            it('should log info and return', async () => {
                sut.ENABLED = false;

                await sut.personExternalSystemSyncEventHandler(new PersonExternalSystemsSyncEvent(faker.string.uuid()));

                expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event.');
            });
        });
    });
});
