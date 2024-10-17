import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonID } from '../../../shared/types/index.js';
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

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        sut.ENABLED = true;
        jest.resetAllMocks();
    });

    describe('handleEmailAddressGeneratedEvent', () => {
        let personId: PersonID;
        let event: EmailAddressGeneratedEvent;
        let person: Person<true>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            event = new EmailAddressGeneratedEvent(personId, faker.string.uuid(), faker.internet.email(), true);
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            await sut.handleEmailAddressGeneratedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            expect(oxServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error when person already exists in OX', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    exists: true,
                },
            });

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(ExistsUserAction));
            expect(oxServiceMock.send).toHaveBeenCalledTimes(1);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Cannot create user in OX, username:${person.referrer} already exists`,
            );
        });

        it('should log error when person cannot be found in DB', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(undefined);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Person not found for personId:${personId}`);
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
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(undefined);

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `No requested email-address found for personId:${personId}`,
            );
        });

        it('should log info and publish OxUserCreatedEvent on success', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    exists: false,
                },
            });
            const fakeOXUserId: string = faker.string.uuid();
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    id: fakeOXUserId,
                    firstname: 'firstname',
                    lastname: 'lastname',
                    username: 'username',
                    primaryEmail: event.address,
                    mailenabled: true,
                },
            });
            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `User created in OX, userId:${fakeOXUserId}, email:${event.address}`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
        });

        it('should log error when persisting oxUserId fails', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce([createMock<EmailAddress<true>>()]);

            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    exists: false,
                },
            });
            const fakeOXUserId: string = faker.string.uuid();
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    id: fakeOXUserId,
                    firstname: 'firstname',
                    lastname: 'lastname',
                    username: 'username',
                    primaryEmail: event.address,
                    mailenabled: true,
                },
            });
            emailRepoMock.save.mockResolvedValueOnce(new EntityCouldNotBeCreated('EmailAddress'));

            await sut.handleEmailAddressGeneratedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `User created in OX, userId:${fakeOXUserId}, email:${event.address}`,
            );
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Persisting oxUserId on emailAddress for personId:${personId} failed`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
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
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Could not create user in OX, error: Request failed`);
        });
    });

    describe('handleEmailAddressChangedEvent', () => {
        let personId: PersonID;
        let event: EmailAddressChangedEvent;
        let person: Person<true>;
        let referrer: string;
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
            contextId: faker.string.numeric();
            contextName: faker.string.alpha();
            event = new EmailAddressChangedEvent(
                personId,
                faker.string.uuid(),
                faker.internet.email(),
                faker.string.uuid(),
                faker.internet.email(),
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
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Person not found for personId:${personId}`);
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
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Person with personId:${personId} has no OXUserId`);
        });

        it('should log error when no requestedEmailAddress is found for person', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(undefined);

            await sut.handleEmailAddressChangedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `No requested email-address found for personId:${personId}`,
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
                `Cannot get data for user with username:${person.referrer} from OX, Aborting Email-Address Change`,
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
                `Could not change email-address for oxUserId:${person.oxUserId} in OX, error: Request failed`,
            );
        });

        it('should publish OxUserChangedEvent on success', async () => {
            personRepositoryMock.findById.mockResolvedValueOnce(person);
            emailRepoMock.findByPersonSortedByUpdatedAtDesc.mockResolvedValueOnce(getRequestedEmailAddresses(email));

            //mock getData
            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: createMock<GetDataForUserResponse>({
                    aliases: [faker.internet.email()],
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
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `Changed primary email-address in OX for user, username:${person.referrer}, new email-address:${email}`,
            );
            expect(eventServiceMock.publish).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    personId: personId,
                    keycloakUsername: referrer,
                    oxUserId: oxUserId,
                    oxUserName: oxUserName,
                    oxContextId: contextId,
                    oxContextName: contextName,
                    primaryEmail: email,
                }),
            );
        });
    });
});
