import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigTestModule, DoFactory, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';
import { OxUserChangedEvent } from '../../../shared/events/ox-user-changed.event.js';
import { PersonRenamedEvent } from '../../../shared/events/person-renamed-event.js';
import {
    PersonenkontextUpdatedData,
    PersonenkontextUpdatedEvent,
    PersonenkontextUpdatedPersonData,
} from '../../../shared/events/personenkontext-updated.event.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Person } from '../../person/domain/person.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { ServiceProviderSystem } from '../../service-provider/domain/service-provider.enum.js';
import { PersonResponse } from '../actions/read-person.action.js';
import { ItslearningMembershipRepo, SetMembershipsResult } from '../repo/itslearning-membership.repo.js';
import { ItslearningPersonRepo } from '../repo/itslearning-person.repo.js';
import { IMSESInstitutionRoleType } from '../types/role.enum.js';
import { ItsLearningPersonsEventHandler } from './itslearning-persons.event-handler.js';

function makeKontextEventData(props?: Partial<PersonenkontextUpdatedData> | undefined): PersonenkontextUpdatedData {
    return {
        id: props?.id ?? faker.string.uuid(),
        orgaId: props?.orgaId ?? faker.string.uuid(),
        parentOrgaId: props?.parentOrgaId ?? faker.string.uuid(),
        rolle: props?.rolle ?? faker.helpers.enumValue(RollenArt),
        rolleId: props?.rolleId ?? faker.string.uuid(),
        orgaTyp: props?.orgaTyp ?? OrganisationsTyp.SCHULE,
        serviceProviderExternalSystems: props?.serviceProviderExternalSystems ?? [ServiceProviderSystem.ITSLEARNING],
        isItslearningOrga: props?.isItslearningOrga ?? true,
    };
}

describe('ItsLearning Persons Event Handler', () => {
    let module: TestingModule;

    let sut: ItsLearningPersonsEventHandler;
    let itslearningPersonRepoMock: DeepMocked<ItslearningPersonRepo>;
    let itslearningMembershipRepoMock: DeepMocked<ItslearningMembershipRepo>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                ItsLearningPersonsEventHandler,
                {
                    provide: ItslearningPersonRepo,
                    useValue: createMock<ItslearningPersonRepo>(),
                },
                {
                    provide: ItslearningMembershipRepo,
                    useValue: createMock<ItslearningMembershipRepo>(),
                },
            ],
        }).compile();

        sut = module.get(ItsLearningPersonsEventHandler);
        itslearningPersonRepoMock = module.get(ItslearningPersonRepo);
        itslearningMembershipRepoMock = module.get(ItslearningMembershipRepo);
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
        it('should call repo with current kontexte', async () => {
            const personId: string = faker.string.uuid();
            const currentKontexte: PersonenkontextUpdatedData[] = [makeKontextEventData()];
            itslearningMembershipRepoMock.setMemberships.mockResolvedValueOnce({
                ok: true,
                value: { deleted: 0, updated: 1 },
            } satisfies Result<SetMembershipsResult, DomainError>);
            const eventID: string = faker.string.uuid();

            await sut.updateMemberships(personId, currentKontexte, eventID);

            expect(itslearningMembershipRepoMock.setMemberships).toHaveBeenCalledTimes(1);
            expect(loggerMock.info).toHaveBeenCalledWith(
                `[EventID: ${eventID}] Set ${currentKontexte.length} memberships for person ${personId}`,
            );
        });

        it('should log errors', async () => {
            const error: DomainError = new ItsLearningError('Test Error');
            const personId: string = faker.string.uuid();
            const currentKontexte: PersonenkontextUpdatedData[] = [makeKontextEventData()];
            itslearningMembershipRepoMock.setMemberships.mockResolvedValueOnce({ ok: false, error } satisfies Result<
                SetMembershipsResult,
                DomainError
            >);
            const eventID: string = faker.string.uuid();

            await sut.updateMemberships(personId, currentKontexte, eventID);

            expect(itslearningMembershipRepoMock.setMemberships).toHaveBeenCalledTimes(1);
            expect(loggerMock.error).toHaveBeenCalledWith(
                `[EventID: ${eventID}] Could not set ${currentKontexte.length} memberships for person ${personId}`,
                error,
            );
        });
    });

    describe('deletePerson', () => {
        it('should delete person in itsLearning', async () => {
            const personID: string = faker.string.uuid();
            itslearningPersonRepoMock.deletePerson.mockResolvedValueOnce(undefined);
            const eventID: string = faker.string.uuid();

            await sut.deletePerson(personID, eventID);

            expect(itslearningPersonRepoMock.deletePerson).toHaveBeenCalledWith(personID, eventID);
            expect(loggerMock.info).toHaveBeenCalledWith(`[EventID: ${eventID}] Person with ID ${personID} deleted.`);
        });

        it('should log error if person could not be deleted', async () => {
            const personID: string = faker.string.uuid();
            itslearningPersonRepoMock.deletePerson.mockResolvedValueOnce(new ItsLearningError('Test Error'));
            const eventID: string = faker.string.uuid();

            await sut.deletePerson(personID, eventID);

            expect(itslearningPersonRepoMock.deletePerson).toHaveBeenCalledWith(personID, eventID);
            expect(loggerMock.error).toHaveBeenCalledWith(
                `[EventID: ${eventID}] Could not delete person with ID ${personID} from itsLearning.`,
            );
        });
    });

    describe('personRenamedEventHandler', () => {
        const oldFirstname: string = faker.person.firstName();
        const oldLastname: string = faker.person.lastName();

        function createPersonAndResponse(params: Partial<Person<true>> = {}): [Person<true>, PersonResponse] {
            if (!('referrer' in params)) {
                params.referrer = faker.internet.userName();
            }

            const person: Person<true> = DoFactory.createPerson(true, params);

            const readPersonResponse: PersonResponse = {
                username: person.id,
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                primaryRoleType: true,
                institutionRole: faker.helpers.enumValue(IMSESInstitutionRoleType),
            };

            return [person, readPersonResponse];
        }

        it('should send person to itsLearning', async () => {
            const [person, personResponse]: [Person<true>, PersonResponse] = createPersonAndResponse();
            itslearningPersonRepoMock.readPerson.mockResolvedValueOnce(personResponse); // Read person
            itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(undefined); // Create person
            const event: PersonRenamedEvent = PersonRenamedEvent.fromPerson(
                person,
                faker.internet.userName(),
                oldFirstname,
                oldLastname,
            );

            await sut.personRenamedEventHandler(event);

            expect(itslearningPersonRepoMock.createOrUpdatePerson).toHaveBeenCalledWith(
                {
                    id: person.id,
                    firstName: person.vorname,
                    lastName: person.familienname,
                    username: person.referrer,
                    institutionRoleType: personResponse.institutionRole,
                },
                `${event.eventID}-PERSON-RENAMED-UPDATE`,
            );
            expect(loggerMock.info).toHaveBeenCalledWith(
                `[EventID: ${event.eventID}] Person with ID ${person.id} updated in itsLearning!`,
            );
        });

        it('should log error if person could not be updated', async () => {
            const [person, personResponse]: [Person<true>, PersonResponse] = createPersonAndResponse();
            itslearningPersonRepoMock.readPerson.mockResolvedValueOnce(personResponse); // Read person
            itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(new ItsLearningError('Test Error')); // Create person
            const event: PersonRenamedEvent = PersonRenamedEvent.fromPerson(
                person,
                faker.internet.userName(),
                oldFirstname,
                oldLastname,
            );

            await sut.personRenamedEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `[EventID: ${event.eventID}] Person with ID ${person.id} could not be updated in itsLearning!`,
            );
        });

        describe('when person is invalid', () => {
            it('should log error, if person has no referrer', async () => {
                const [person]: [Person<true>, PersonResponse] = createPersonAndResponse({ referrer: undefined });
                const event: PersonRenamedEvent = PersonRenamedEvent.fromPerson(
                    person,
                    faker.internet.userName(),
                    oldFirstname,
                    oldLastname,
                );

                await sut.personRenamedEventHandler(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `[EventID: ${event.eventID}] Person with ID ${person.id} has no username!`,
                );
            });
        });

        describe("when person doesn't exist in itslearning", () => {
            it('should log info', async () => {
                const [person]: [Person<true>, PersonResponse] = createPersonAndResponse();
                itslearningPersonRepoMock.readPerson.mockResolvedValueOnce(undefined); // Read person
                const event: PersonRenamedEvent = PersonRenamedEvent.fromPerson(
                    person,
                    faker.internet.userName(),
                    oldFirstname,
                    oldLastname,
                );

                await sut.personRenamedEventHandler(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `[EventID: ${event.eventID}] Person with ID ${person.id} is not in itslearning, ignoring.`,
                );
            });
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            const [person]: [Person<true>, PersonResponse] = createPersonAndResponse();
            const event: PersonRenamedEvent = PersonRenamedEvent.fromPerson(
                person,
                faker.internet.userName(),
                oldFirstname,
                oldLastname,
            );

            await sut.personRenamedEventHandler(event);

            expect(loggerMock.info).toHaveBeenCalledWith(`[EventID: ${event.eventID}] Not enabled, ignoring event.`);
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
            const kontextData: PersonenkontextUpdatedData = makeKontextEventData({ rolle: RollenArt.LERN });
            itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(undefined);
            const eventID: string = faker.string.uuid();

            await sut.updatePerson(person, [kontextData], eventID);

            expect(itslearningPersonRepoMock.createOrUpdatePerson).toHaveBeenCalledWith(
                {
                    id: person.id,
                    firstName: person.vorname,
                    lastName: person.familienname,
                    username: person.referrer,
                    institutionRoleType: IMSESInstitutionRoleType.STUDENT,
                },
                eventID,
            );
            expect(loggerMock.info).toHaveBeenCalledWith(
                `[EventID: ${eventID}] Person with ID ${person.id} created in itsLearning!`,
            );
        });

        it('should log error if person could not be created', async () => {
            const kontextData: PersonenkontextUpdatedData = makeKontextEventData({ rolle: RollenArt.LERN });
            itslearningPersonRepoMock.createOrUpdatePerson.mockResolvedValueOnce(new ItsLearningError('Test Error'));
            const eventID: string = faker.string.uuid();

            await sut.updatePerson(person, [kontextData], eventID);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `[EventID: ${eventID}] Person with ID ${person.id} could not be sent to itsLearning! Error: Test Error`,
            );
        });

        describe('when person is invalid', () => {
            it('should log error, if person has no referrer', async () => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { referrer, ...personWithoutReferrer }: PersonenkontextUpdatedPersonData = person;
                const eventID: string = faker.string.uuid();

                await sut.updatePerson(personWithoutReferrer, [createMock()], eventID);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `[EventID: ${eventID}] Person with ID ${person.id} has no username!`,
                );
            });
        });
    });

    describe('oxUserChangedEventHandler', () => {
        const personId: string = faker.string.uuid();
        const email: string = faker.internet.email();
        const generatedEvent: OxUserChangedEvent = new OxUserChangedEvent(
            personId,
            faker.internet.userName(),
            faker.string.uuid(),
            faker.internet.userName(),
            faker.string.uuid(),
            faker.string.uuid(),
            email,
        );

        it('should update email', async () => {
            itslearningPersonRepoMock.updateEmail.mockResolvedValueOnce(undefined); // Update email

            await sut.oxUserChangedEventHandler(generatedEvent);

            expect(itslearningPersonRepoMock.updateEmail).toHaveBeenCalledWith(
                personId,
                email,
                `${generatedEvent.eventID}-EMAIL-UPDATE`,
            );
            expect(loggerMock.info).toHaveBeenCalledWith(
                `[EventID: ${generatedEvent.eventID}] Updated E-Mail for person with ID ${personId}!`,
            );
        });

        it('should log error, if email could not be updated', async () => {
            itslearningPersonRepoMock.updateEmail.mockResolvedValueOnce(new ItsLearningError('Test Error')); // Update email

            await sut.oxUserChangedEventHandler(generatedEvent);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `[EventID: ${generatedEvent.eventID}] Could not update E-Mail for person with ID ${personId}!`,
            );
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            itslearningPersonRepoMock.updateEmail.mockResolvedValueOnce(undefined); // Update email

            await sut.oxUserChangedEventHandler(generatedEvent);

            expect(loggerMock.info).toHaveBeenCalledWith(
                `[EventID: ${generatedEvent.eventID}] Not enabled, ignoring email update.`,
            );
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

        it('should call updateMemberships with correct number of kontexte', async () => {
            const schoolKontext: PersonenkontextUpdatedData = makeKontextEventData({
                serviceProviderExternalSystems: [ServiceProviderSystem.ITSLEARNING],
            });
            const klasseKontext: PersonenkontextUpdatedData = makeKontextEventData({
                parentOrgaId: schoolKontext.orgaId,
                isItslearningOrga: false,
                serviceProviderExternalSystems: [ServiceProviderSystem.ITSLEARNING],
                orgaTyp: OrganisationsTyp.KLASSE,
            });

            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [schoolKontext, klasseKontext],
            );

            jest.spyOn(sut, 'updatePerson').mockResolvedValueOnce(undefined);
            const updateMembershipsSpy: jest.SpyInstance = jest
                .spyOn(sut, 'updateMemberships')
                .mockResolvedValueOnce(undefined);
            jest.spyOn(sut, 'deletePerson').mockResolvedValueOnce(undefined);

            await sut.updatePersonenkontexteEventHandler(event);

            expect(updateMembershipsSpy).toHaveBeenCalledTimes(1);
            expect(updateMembershipsSpy).toHaveBeenCalledWith(
                event.person.id,
                expect.objectContaining({ length: 2 }),
                `${event.eventID}-UPDATE-MEMBERSHIPS`,
            );
        });

        it('should not call updatePerson, if no relevant kontext exists', async () => {
            const event: PersonenkontextUpdatedEvent = new PersonenkontextUpdatedEvent(
                { id: faker.string.uuid(), vorname: faker.person.firstName(), familienname: faker.person.lastName() },
                [],
                [],
                [
                    makeKontextEventData({
                        serviceProviderExternalSystems: [ServiceProviderSystem.NONE],
                        isItslearningOrga: false,
                    }),
                    makeKontextEventData({
                        orgaTyp: OrganisationsTyp.LAND,
                        serviceProviderExternalSystems: [ServiceProviderSystem.ITSLEARNING],
                        isItslearningOrga: true,
                    }),
                    makeKontextEventData({
                        orgaTyp: OrganisationsTyp.KLASSE,
                        parentOrgaId: undefined,
                        serviceProviderExternalSystems: [ServiceProviderSystem.ITSLEARNING],
                    }),
                ],
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

            expect(loggerMock.info).toHaveBeenCalledWith(`[EventID: ${event.eventID}] Not enabled, ignoring event.`);
        });
    });
});
