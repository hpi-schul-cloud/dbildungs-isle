import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonID, PersonReferrer } from '../../../shared/types/index.js';
import { OxEventHandler } from './ox-event-handler.js';
import { OxService } from './ox.service.js';
import { CreateUserAction } from '../actions/user/create-user.action.js';
import { OxError } from '../../../shared/error/ox.error.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { ExistsUserAction } from '../actions/user/exists-user.action.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { EmailAddress } from '../../email/domain/email-address.js';
import { EmailAddressChangedEvent } from '../../../shared/events/email-address-changed.event.js';
import { GetDataForUserResponse } from '../actions/user/get-data-user.action.js';
import { EntityCouldNotBeCreated } from '../../../shared/error/index.js';
import { OXGroupID, OXUserID } from '../../../shared/types/ox-ids.types.js';
import { ListGroupsAction } from '../actions/group/list-groups.action.js';
import { EmailAddressAlreadyExistsEvent } from '../../../shared/events/email-address-already-exists.event.js';
import { PersonDeletedEvent } from '../../../shared/events/person-deleted.event.js';
import { EmailAddressDisabledEvent } from '../../../shared/events/email-address-disabled.event.js';
import { PersonenkontextUpdatedEvent } from '../../../shared/events/personenkontext-updated.event.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { DisabledEmailAddressGeneratedEvent } from '../../../shared/events/disabled-email-address-generated.event.js';

describe('OxEventHandler', () => {
    let module: TestingModule;

    let sut: OxEventHandler;
    let oxServiceMock: DeepMocked<OxService>;
    let loggerMock: DeepMocked<ClassLogger>;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let emailRepoMock: DeepMocked<EmailRepo>;
    let eventServiceMock: DeepMocked<EventService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                OxEventHandler,
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: ServiceProviderRepo,
                    useValue: createMock<ServiceProviderRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: EmailRepo,
                    useValue: createMock<EmailRepo>(),
                },
                {
                    provide: OxService,
                    useValue: createMock<OxService>(),
                },
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
            ],
        }).compile();

        sut = module.get(OxEventHandler);
        oxServiceMock = module.get(OxService);
        loggerMock = module.get(ClassLogger);

        personRepositoryMock = module.get(PersonRepository);
        emailRepoMock = module.get(EmailRepo);
        eventServiceMock = module.get(EventService);
    });

    function getRequestedEmailAddresses(address?: string): EmailAddress<true>[] {
        const emailAddress: EmailAddress<true> = createMock<EmailAddress<true>>({
            get address(): string {
                return address ?? faker.internet.email();
            },
        });
        return [emailAddress];
    }

    function mockUserCreationRequest(userId: OXUserID, emailAddress: string): void {
        //mock create-oxUser-request
        oxServiceMock.send.mockResolvedValueOnce({
            ok: true,
            value: {
                id: userId,
                firstname: 'firstname',
                lastname: 'lastname',
                username: 'username',
                primaryEmail: emailAddress,
                mailenabled: true,
            },
        });
    }

    /**
     * Mock group retrieval as successful
     * @param oxUserId
     * @param oxGroupId default is 'groupId'
     */
    function mockGroupRetrievalRequestSuccessful(oxUserId: OXUserID, oxGroupId: OXGroupID = 'groupId'): void {
        oxServiceMock.send.mockResolvedValueOnce({
            ok: true,
            value: {
                groups: [
                    {
                        displayname: 'groupDisplayName',
                        id: oxGroupId,
                        name: 'groupName',
                        memberIds: [oxUserId],
                    },
                ],
            },
        });
    }

    /**
     * mock exists-oxUser-request
     * @param exists default is FALSE
     */
    function mockExistsUserRequest(exists: boolean = false): void {
        oxServiceMock.send.mockResolvedValueOnce({
            ok: true,
            value: {
                exists: exists,
            },
        });
    }

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        sut.ENABLED = true;
        jest.resetAllMocks();
    });

    describe('createOxGroup', () => {
        let personId: PersonID;
        let fakeDstNr: string;
        let event: EmailAddressGeneratedEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            fakeDstNr = faker.string.numeric();
            event = new EmailAddressGeneratedEvent(
                personId,
                faker.internet.userName(),
                faker.string.uuid(),
                faker.internet.email(),
                true,
                fakeDstNr,
            );
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
        });

        describe('when creating group fails', () => {
            it('should log error about failing oxGroup-creation', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request: empty result -> no groups found
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [],
                    },
                });
                //mock create-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Create OxGroup with name:lehrer-${fakeDstNr}, displayName:lehrer-${fakeDstNr}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('getOxGroupByName', () => {
        let personId: PersonID;
        let fakeDstNr: string;
        let event: EmailAddressGeneratedEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            fakeDstNr = faker.string.numeric();
            event = new EmailAddressGeneratedEvent(
                personId,
                faker.internet.userName(),
                faker.string.uuid(),
                faker.internet.email(),
                true,
                fakeDstNr,
            );
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
        });

        describe('when existing group is found', () => {
            it('should return the existing groups id', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [
                            {
                                displayname: `lehrer-${fakeDstNr}`,
                                id: 'id',
                                name: `lehrer-${fakeDstNr}`,
                                memberIds: [],
                            },
                        ],
                    },
                });

                //mock add-member-to-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });
                //mock changeByModuleAccess request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Found existing oxGroup for oxGroupName:lehrer-${fakeDstNr}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
            });
        });

        describe('when OX-request fails', () => {
            it('should log error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError('mockError'),
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(ListGroupsAction));

                expect(loggerMock.error).toHaveBeenCalledWith(`Could Not Retrieve Groups For Context, contextId:10`);
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
            });
        });

        describe('when no matching groups is found', () => {
            it('should log error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request, mock no matching group found
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [],
                    },
                });
                const fakeOxGroupId: OXGroupID = faker.string.uuid();
                //mock create-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        id: fakeOxGroupId,
                    },
                });
                //mock add-member-to-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });
                //mock changeByModuleAccess request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(ListGroupsAction));

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Found No Matching OxGroup For OxGroupName:lehrer-${fakeDstNr}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
            });
        });

        describe('when multiple groups are found for same groupName', () => {
            it('should log error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request, mock no matching group found
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [
                            {
                                displayname: `lehrer-${fakeDstNr}`,
                                id: 'id',
                                name: `lehrer-${fakeDstNr}`,
                                memberIds: [],
                            },
                            {
                                displayname: `lehrer-${fakeDstNr}`,
                                id: 'id',
                                name: `lehrer-${fakeDstNr}-`,
                                memberIds: [],
                            },
                        ],
                    },
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(ListGroupsAction));

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Found multiple OX-groups For OxGroupName:lehrer-${fakeDstNr}, Cannot Proceed`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('addOxUserToOxGroup', () => {
        let personId: PersonID;
        let fakeDstNr: string;
        let event: EmailAddressGeneratedEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            fakeDstNr = faker.string.numeric();
            event = new EmailAddressGeneratedEvent(
                personId,
                faker.internet.userName(),
                faker.string.uuid(),
                faker.internet.email(),
                true,
                fakeDstNr,
            );
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
        });

        describe('when adding user as member to group fails', () => {
            it('should log error about failing addition to group', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([
                    createMock<EmailAddress<true>>(),
                ]);

                //mock exists-oxUser-request
                mockExistsUserRequest(false);
                //mock create-oxUser-request
                const fakeOXUserId: string = faker.string.uuid();
                mockUserCreationRequest(fakeOXUserId, event.address);
                //mock list-oxGroups-request, empty result -> no groups found
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [],
                    },
                });
                const fakeOxGroupId: OXGroupID = faker.string.uuid();
                //mock create-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        id: fakeOxGroupId,
                    },
                });
                //mock add-member-to-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });

                await sut.handleEmailAddressGeneratedEvent(event);

                expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Add OxUser To OxGroup, oxUserId:${fakeOXUserId}, oxGroupId:${fakeOxGroupId}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('handleEmailAddressGeneratedEvent', () => {
        let personId: PersonID;
        let referrer: PersonReferrer;
        let event: EmailAddressGeneratedEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            referrer = faker.internet.userName();
            event = new EmailAddressGeneratedEvent(
                personId,
                referrer,
                faker.string.uuid(),
                faker.internet.email(),
                true,
                faker.string.numeric(),
            );
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: referrer });
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            await sut.handleEmailAddressGeneratedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            expect(oxServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error when person already exists in OX', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);
            //mock exists-oxUser-request
            mockExistsUserRequest(true);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(ExistsUserAction));
            expect(oxServiceMock.send).toHaveBeenCalledTimes(1);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Cannot create user in OX, username:${person.referrer} already exists, personId:${personId}`,
            );
        });

        it('should log error when person cannot be found in DB', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(undefined);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person not found for personId:${personId}, referrer:${referrer}`,
            );
        });

        it('should log error when person has no referrer set', async () => {
            person.referrer = undefined;
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person with personId:${personId} has no referrer: cannot create OXEmailAddress`,
            );
        });

        it('should log error when EmailAddress for person cannot be found', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([]);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `No REQUESTED email-address found for personId:${personId}`,
            );
        });

        it('should log info and publish OxUserCreatedEvent on success', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            //mock exists-oxUser-request
            mockExistsUserRequest(false);
            //mock create-oxUser-request
            const fakeOXUserId: string = faker.string.uuid();
            mockUserCreationRequest(fakeOXUserId, event.address);
            //mock list-oxGroups-request, no result -> mocks no group found
            const fakeOXGroupId: string = faker.string.uuid();
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    groups: [],
                },
            });
            //mock create-oxGroup-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    id: fakeOXGroupId,
                },
            });
            //mock add-member-to-oxGroup-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    status: {
                        code: 'success',
                    },
                    data: undefined,
                },
            });
            //mock changeByModuleAccess request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenCalledWith(
                `User created in OX, oxUserId:${fakeOXUserId}, oxEmail:${event.address}, personId:${personId}, referrer:${referrer}`,
            );
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Successfully Added OxUser To OxGroup, oxUserId:${fakeOXUserId}, oxGroupId:${fakeOXGroupId}`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
        });

        it('should log error but still publish OxUserCreatedEvent when changeByModuleAccess request fails', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            //mock exists-oxUser-request
            mockExistsUserRequest(false);
            //mock create-oxUser-request
            const fakeOXUserId: string = faker.string.uuid();
            mockUserCreationRequest(fakeOXUserId, event.address);
            //mock list-oxGroups-request, no result -> mocks no group found
            const fakeOXGroupId: string = faker.string.uuid();
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    groups: [],
                },
            });
            //mock create-oxGroup-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    id: fakeOXGroupId,
                },
            });
            //mock add-member-to-oxGroup-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    status: {
                        code: 'success',
                    },
                    data: undefined,
                },
            });
            //mock changeByModuleAccess request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: new OxError(),
            });

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Could Not Adjust GlobalAddressBookDisabled For oxUserId:${fakeOXUserId}, personId:${personId}, referrer:${referrer}, error:Unknown OX-error`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
        });

        it('should log error when persisting oxUserId fails', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            //mock exists-oxUser-request
            mockExistsUserRequest(false);
            //mock create-oxUser-request
            const fakeOXUserId: string = faker.string.uuid();
            mockUserCreationRequest(fakeOXUserId, event.address);
            //mock list-all-oxGroups-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    groups: [
                        {
                            displayname: 'string',
                            id: 'id',
                            name: 'name',
                            memberIds: [],
                        },
                    ],
                },
            });
            //mock create-oxGroup-request
            const fakeOxGroupId: OXGroupID = faker.string.uuid();
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    id: fakeOxGroupId,
                },
            });
            //mock add-member-to-oxGroup-request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    status: {
                        code: 'success',
                    },
                    data: undefined,
                },
            });

            emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeCreated('EmailAddress'));

            //mock changeByModuleAccess request
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `User created in OX, oxUserId:${fakeOXUserId}, oxEmail:${event.address}, personId:${personId}, referrer:${referrer}`,
            );
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Persisting oxUserId on emailAddress failed, personId:${personId}, referrer:${referrer}`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
        });

        it('should log error on failure', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    exists: false,
                },
            });

            oxServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: new OxError('Request failed'),
            });
            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Could not create user in OX, personId:${personId}, referrer:${referrer}, error:Request failed`,
            );
        });
    });

    describe('handleEmailAddressChangedEvent', () => {
        let personId: PersonID;
        let event: EmailAddressChangedEvent;
        let person: Person<true>;
        let referrer: PersonReferrer;
        let email: string;
        let oxUserId: string;
        let oxUserName: string;
        let contextId: string;
        let contextName: string;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            referrer = faker.internet.userName();
            email = faker.internet.email();
            oxUserId = faker.string.numeric();
            oxUserName = faker.internet.userName();
            contextId = '10';
            contextName = 'testContext';
            event = new EmailAddressChangedEvent(
                personId,
                referrer,
                faker.string.uuid(),
                faker.internet.email(),
                faker.string.uuid(),
                faker.internet.email(),
                faker.string.numeric(),
            );
            person = createMock<Person<true>>({ email: email, referrer: referrer, oxUserId: oxUserId });
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            await sut.handleEmailAddressChangedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            expect(oxServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error when person cannot be found in DB', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(undefined);

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person not found for personId:${personId}, referrer:${referrer}`,
            );
        });

        it('should log error when person has no referrer set', async () => {
            person.referrer = undefined;
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person with personId:${personId} has no referrer: Cannot Change Email-Address In OX`,
            );
        });

        it('should log error when person has no oxUserId set', async () => {
            person.oxUserId = undefined;
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person has no OXUserId, personId:${personId}, referrer:${referrer}`,
            );
        });

        it('should log error when no requestedEmailAddress is found for person', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([]);

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `No REQUESTED email-address found for personId:${personId}`,
            );
        });

        it('should log error when getData for user request fails', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(getRequestedEmailAddresses());

            oxServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: new OxError('Request failed'),
            });

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(1);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Cannot get data for oxUsername:${person.referrer} from OX, Aborting Email-Address Change, personId:${personId}, referrer:${referrer}`,
            );
        });

        it('should log error when changeUser request fails', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(getRequestedEmailAddresses());

            //mock getData
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: createMock<GetDataForUserResponse>({
                    aliases: [faker.internet.email()],
                }),
            });

            //mock changeUser
            oxServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: new OxError('Request failed'),
            });

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(2);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Could not change email-address for oxUserId:${person.oxUserId}, personId:${personId}, referrer:${referrer}, error:Request failed`,
            );
        });

        it('should publish OxUserChangedEvent on success', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(getRequestedEmailAddresses(email));
            const currentAliases: string[] = [faker.internet.email()];
            //mock getData
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: createMock<GetDataForUserResponse>({
                    aliases: currentAliases,
                    username: oxUserName,
                    id: oxUserId,
                    primaryEmail: email,
                }),
            });

            //mock changeUser as success
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(2);
            expect(loggerMock.error).toHaveBeenCalledTimes(0);
            expect(loggerMock.info).toHaveBeenCalledWith(
                `Found mostRecentRequested Email-Address:${JSON.stringify(email)} For personId:${personId}`,
            );
            //use regex, because strict comparison fails, local test-var currentAliases has changed by the implemented function when expect is checked here
            expect(loggerMock.info).toHaveBeenCalledWith(expect.stringMatching(/Found Current aliases:.*/));
            expect(loggerMock.info).toHaveBeenCalledWith(
                `Added New alias:${email}, personId:${personId}, referrer:${referrer}`,
            );
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Changed primary email-address in OX for user, personId:${personId}, referrer:${referrer}, oxUserId:${oxUserId}, oxUsername:${referrer}, new email-address:${email}`,
            );
            expect(eventServiceMock.publish).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    personId: personId,
                    keycloakUsername: referrer,
                    oxUserId: oxUserId,
                    oxUserName: referrer, //this is the new OxUserName, it's changed on renaming in SPSH
                    oxContextId: contextId,
                    oxContextName: contextName,
                    primaryEmail: email,
                }),
            );
        });
    });

    /**
     * Testing the called method changeOxUser in general is done via test-cases for handleEmailAddressChangedEvent.
     */
    describe('handleDisabledEmailAddressGeneratedEvent', () => {
        let personId: PersonID;
        let event: DisabledEmailAddressGeneratedEvent;
        let person: Person<true>;
        let referrer: PersonReferrer;
        let emailId: string;
        let email: string;
        let domain: string;
        let oxUserId: string;
        let oxUserName: string;
        let contextId: string;
        let contextName: string;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            referrer = faker.internet.userName();
            emailId = faker.string.uuid();
            email = faker.internet.email();
            domain = faker.internet.domainName();
            oxUserId = faker.string.numeric();
            oxUserName = faker.internet.userName();
            contextId = '10';
            contextName = 'testContext';
            event = new DisabledEmailAddressGeneratedEvent(personId, referrer, email, emailId, domain);
            person = createMock<Person<true>>({ email: email, referrer: referrer, oxUserId: oxUserId });
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            await sut.handleDisabledEmailAddressGeneratedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            expect(oxServiceMock.send).not.toHaveBeenCalled();
        });

        it('should publish DisabledOxUserChangedEvent on success', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(getRequestedEmailAddresses(email));
            const currentAliases: string[] = [faker.internet.email()];
            //mock getData
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: createMock<GetDataForUserResponse>({
                    aliases: currentAliases,
                    username: oxUserName,
                    id: oxUserId,
                    primaryEmail: email,
                }),
            });

            //mock changeUser as success
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            });

            await sut.handleDisabledEmailAddressGeneratedEvent(event);

            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Changed primary email-address in OX for user, personId:${personId}, referrer:${referrer}, oxUserId:${oxUserId}, oxUsername:${referrer}, new email-address:${email}`,
            );
            expect(eventServiceMock.publish).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    personId: personId,
                    keycloakUsername: referrer,
                    oxUserId: oxUserId,
                    oxUserName: referrer, //this is the new OxUserName, it's changed on renaming in SPSH
                    oxContextId: contextId,
                    oxContextName: contextName,
                    primaryEmail: email,
                }),
            );
        });
    });

    describe('handleEmailAddressAlreadyExistsEvent', () => {
        let personId: PersonID;
        let event: EmailAddressAlreadyExistsEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            event = new EmailAddressAlreadyExistsEvent(personId, faker.string.uuid());
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
        });

        describe('when handler is disabled', () => {
            it('should log and skip processing when not enabled', async () => {
                sut.ENABLED = false;
                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            });
        });

        describe('when person is not found', () => {
            it('should log error if person does not exist', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(undefined);

                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(`Person not found for personId:${event.personId}`);
            });
        });

        describe('when person has no oxUserId', () => {
            it('should log error if oxUserId is missing', async () => {
                person.oxUserId = undefined;
                personRepositoryMock.findById.mockResolvedValueOnce(person);

                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Person with personId:${event.personId} does not have an oxUserId. Cannot add to group.`,
                );
            });
        });

        describe('successful scenario', () => {
            it('should successfully process event and publish OxUserChangedEvent', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);

                //mock list-oxGroups-request, no result -> mocks no group found
                const fakeOXGroupId: string = faker.string.uuid();
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [],
                    },
                });
                //mock create-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        id: fakeOXGroupId,
                    },
                });
                //mock add-member-to-oxGroup-request
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });

                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.info).toHaveBeenLastCalledWith(
                    `Successfully added user to group, personId:${event.personId}, oxUserId:${person.oxUserId}, oxGroupId:${fakeOXGroupId}`,
                );
                expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
            });
        });

        describe('failure scenarios', () => {
            it('should log error if group creation/retrieval fails', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);

                // Mock group creation/retrieval failure
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });

                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        `Get or create OX group failed, personId:${event.personId}, oxUserId:${person.oxUserId}, orgaKennung:${event.orgaKennung}`,
                    ),
                );
            });

            it('should log error if adding user to group fails', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);

                const fakeOXGroupId: string = faker.string.uuid();

                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [],
                    },
                });
                // Mock group creation/retrieval success
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        id: fakeOXGroupId,
                    },
                });

                // Mock add user to group failure
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });

                await sut.handleEmailAddressAlreadyExistsEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        `Failed to add user to group, personId:${event.personId}, oxUserId:${person.oxUserId}, oxGroupId:${fakeOXGroupId}`,
                    ),
                );
            });
        });
    });

    describe('handlePersonDeletedEvent', () => {
        let personId: PersonID;
        let event: PersonDeletedEvent;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            event = new PersonDeletedEvent(personId, faker.string.uuid(), faker.internet.email());
        });

        describe('when handler is disabled', () => {
            it('should log and skip processing when not enabled', async () => {
                sut.ENABLED = false;
                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            });
        });

        describe('when emailAddress is NOT defined in event', () => {
            it('should log error about missing emailAddress', async () => {
                event = new PersonDeletedEvent(personId, faker.string.uuid(), undefined);

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    'Cannot Create OX-change-user-request, Email-Address Is Not Defined',
                );
            });
        });

        describe('when EmailAddress-entity CANNOT be found via address', () => {
            it('should log error about that', async () => {
                event = new PersonDeletedEvent(personId, faker.string.uuid(), faker.internet.email());

                emailRepoMock.findByAddress.mockResolvedValueOnce(undefined);

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Cannot Create OX-change-user-request For address:${event.emailAddress} Could Not Be Found`,
                );
            });
        });

        describe('when oxUserId is NOT defined on found EmailAddress', () => {
            it('should log error about missing oxUserId', async () => {
                event = new PersonDeletedEvent(personId, faker.string.uuid(), faker.internet.email());
                emailRepoMock.findByAddress.mockResolvedValueOnce(
                    createMock<EmailAddress<true>>({
                        get oxUserID(): Option<string> {
                            return undefined;
                        },
                    }),
                );

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Cannot Create OX-change-user-request For address:${event.emailAddress}, OxUserId Is Not Defined`,
                );
            });
        });

        describe('when usernameChange-request to OX fails', () => {
            it('should log error about failing request', async () => {
                event = new PersonDeletedEvent(personId, faker.string.uuid(), faker.internet.email());
                const oxUserId: OXUserID = faker.string.numeric();

                emailRepoMock.findByAddress.mockResolvedValueOnce(
                    createMock<EmailAddress<true>>({
                        get oxUserID(): Option<string> {
                            return oxUserId;
                        },
                    }),
                );

                // Mock group retrieval successfully
                mockGroupRetrievalRequestSuccessful(oxUserId);

                // Mock removal as member from oxGroups successfully
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });

                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Change OxUsername For oxUserId:${oxUserId} After PersonDeletedEvent, error:Unknown OX-error`,
                );
            });
        });

        describe('when usernameChange-request to OX succeeds', () => {
            it('should log info about success', async () => {
                event = new PersonDeletedEvent(personId, faker.string.uuid(), faker.internet.email());
                const oxUserId: OXUserID = faker.string.numeric();

                emailRepoMock.findByAddress.mockResolvedValueOnce(
                    createMock<EmailAddress<true>>({
                        get oxUserID(): Option<string> {
                            return oxUserId;
                        },
                    }),
                );

                // Mock group retrieval successfully
                mockGroupRetrievalRequestSuccessful(oxUserId);

                // Mock removal as member from oxGroups successfully
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });

                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });

                await sut.handlePersonDeletedEvent(event);

                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Successfully Changed OxUsername For oxUserId:${oxUserId} After PersonDeletedEvent`,
                );
            });
        });
    });

    describe('handleEmailAddressDisabledEvent', () => {
        let personId: PersonID;
        let username: string;
        let oxUserId: OXUserID;
        let event: EmailAddressDisabledEvent;
        let person: Person<true>;
        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            username = faker.internet.userName();
            oxUserId = faker.string.numeric();
            event = new EmailAddressDisabledEvent(personId, username);
            person = createMock<Person<true>>({
                id: personId,
                email: faker.internet.email(),
                referrer: username,
                oxUserId: oxUserId,
            });
        });
        describe('when handler is disabled', () => {
            it('should log and skip processing when not enabled', async () => {
                sut.ENABLED = false;
                await sut.handleEmailAddressDisabledEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            });
        });
        describe('when person is not found', () => {
            it('should log error if person does not exist', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(undefined);
                await sut.handleEmailAddressDisabledEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(`Could Not Find Person For personId:${event.personId}`);
            });
        });
        describe('when person is found BUT has NO oxUserId', () => {
            it('should log error if person does not have a oxUserId', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(createMock<Person<true>>({ oxUserId: undefined }));
                await sut.handleEmailAddressDisabledEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Remove Person From OxGroups, No OxUserId For personId:${event.personId}`,
                );
            });
        });
        describe('when listing groups for user fails', () => {
            it('should log error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                //mock listing groups results in error
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });
                await sut.handleEmailAddressDisabledEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Retrieving OxGroups For OxUser Failed, personId:${event.personId}`,
                );
            });
        });
        describe('when removing user from groups fails for at least one group', () => {
            it('should log error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(person);
                //mock listing groups
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        groups: [
                            {
                                displayname: 'group1-displayname',
                                id: 'group1-id',
                                name: 'group1-name',
                                memberIds: [oxUserId],
                            },
                            {
                                displayname: 'group2-displayname',
                                id: 'group2-id',
                                name: 'group2-name',
                                memberIds: [oxUserId],
                            },
                        ],
                    },
                });
                //mock removing member from group-1 succeeds
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: 'body',
                    },
                });
                //mock removing member from group-2 results in error
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });
                await sut.handleEmailAddressDisabledEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Successfully Removed OxUser From OxGroup, oxUserId:${oxUserId}, oxGroupId:group1-id`,
                );
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Remove OxUser From OxGroup, oxUserId:${oxUserId}, oxGroupId:group2-id`,
                );
            });
        });
    });

    describe('handlePersonenkontextUpdatedEvent', () => {
        let personId: PersonID;
        let username: string;
        let oxUserId: OXUserID;
        let oxGroupId: OXGroupID;
        let rollenArtLehrPKOrgaKennung: string;
        let event: PersonenkontextUpdatedEvent;
        let person: Person<true>;
        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            username = faker.internet.userName();
            rollenArtLehrPKOrgaKennung = faker.string.numeric(7);
            oxUserId = faker.string.numeric();
            oxGroupId = faker.string.numeric();
            event = new PersonenkontextUpdatedEvent(
                {
                    id: personId,
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    referrer: faker.internet.userName(),
                },
                [],
                [
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.LEHR,
                        rolleId: faker.string.uuid(),
                        orgaKennung: rollenArtLehrPKOrgaKennung,
                        isItslearningOrga: false,
                        serviceProviderExternalSystems: [],
                    },
                    {
                        id: faker.string.uuid(),
                        orgaId: faker.string.uuid(),
                        rolle: RollenArt.EXTERN,
                        rolleId: faker.string.uuid(),
                        orgaKennung: faker.string.numeric(7),
                        isItslearningOrga: false,
                        serviceProviderExternalSystems: [],
                    },
                ],
                [],
            );
        });
        describe('when handler is disabled', () => {
            it('should log and skip processing when not enabled', async () => {
                sut.ENABLED = false;
                await sut.handlePersonenkontextUpdatedEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            });
        });
        describe('when person CANNOT be found', () => {
            it('should log error about that', async () => {
                personRepositoryMock.findById.mockResolvedValue(undefined);
                await sut.handlePersonenkontextUpdatedEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(`Could Not Find Person For personId:${event.person.id}`);
            });
        });
        describe('when oxUserId is NOT defined', () => {
            it('should log error about that', async () => {
                person = createMock<Person<true>>({
                    email: faker.internet.email(),
                    referrer: username,
                    oxUserId: undefined,
                });
                personRepositoryMock.findById.mockResolvedValue(person);
                await sut.handlePersonenkontextUpdatedEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(`OxUserId Not Defined For personId:${event.person.id}`);
            });
        });
        describe('when getting oxGroupId by oxGroupName fails', () => {
            it('should log error about that', async () => {
                person = createMock<Person<true>>({
                    email: faker.internet.email(),
                    referrer: username,
                    oxUserId: faker.string.numeric(),
                });
                //mock Ox-getOxGroupByName-request results in an error
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: false,
                    error: new OxError(),
                });
                personRepositoryMock.findById.mockResolvedValue(person);
                await sut.handlePersonenkontextUpdatedEvent(event);
                expect(loggerMock.error).toHaveBeenCalledWith(
                    `Could Not Get OxGroupId For oxGroupName:${'lehrer-' + rollenArtLehrPKOrgaKennung}`,
                );
            });
        });
        describe('when removing user as member from oxGroup is successful', () => {
            it('should log info about that', async () => {
                person = createMock<Person<true>>({
                    email: faker.internet.email(),
                    referrer: username,
                    oxUserId: oxUserId,
                });
                personRepositoryMock.findById.mockResolvedValue(person);
                // Mock group retrieval successfully
                mockGroupRetrievalRequestSuccessful(oxUserId, oxGroupId);
                //mock Ox-removeOxUserFromOxGroup-request is successful
                oxServiceMock.send.mockResolvedValueOnce({
                    ok: true,
                    value: {
                        status: {
                            code: 'success',
                        },
                        data: undefined,
                    },
                });
                await sut.handlePersonenkontextUpdatedEvent(event);
                expect(loggerMock.info).toHaveBeenCalledWith(
                    `Successfully Removed OxUser From OxGroup, oxUserId:${oxUserId}, oxGroupId:${oxGroupId}`,
                );
            });
        });
    });
});
