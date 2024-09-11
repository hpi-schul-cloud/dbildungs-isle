import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonID, RolleID } from '../../../shared/types/index.js';
import { OxEventHandler } from './ox-event-handler.js';
import { OxService } from './ox.service.js';
import { CreateUserAction } from '../actions/user/create-user.action.js';
import { OxError } from '../../../shared/error/ox.error.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { ServiceProviderKategorie } from '../../service-provider/domain/service-provider.enum.js';
import { Person } from '../../person/domain/person.js';
import { EmailAddressGeneratedEvent } from '../../../shared/events/email-address-generated.event.js';
import { ExistsUserAction } from '../actions/user/exists-user.action.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';

describe('OxEventHandler', () => {
    let module: TestingModule;

    let sut: OxEventHandler;
    let oxServiceMock: DeepMocked<OxService>;
    let loggerMock: DeepMocked<ClassLogger>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let dbiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let serviceProviderRepoMock: DeepMocked<ServiceProviderRepo>;
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

        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        rolleRepoMock = module.get(RolleRepo);
        personRepositoryMock = module.get(PersonRepository);
        serviceProviderRepoMock = module.get(ServiceProviderRepo);
        eventServiceMock = module.get(EventService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        sut.ENABLED = true;
        jest.resetAllMocks();
    });

    describe('handlePersonenkontextCreatedEvent', () => {
        let personId: PersonID;
        let rolleId: RolleID;
        let event: EmailAddressGeneratedEvent;

        let personenkontexte: Personenkontext<true>[];
        let rolle: Rolle<true>;
        let person: Person<true>;
        let rolleMap: Map<string, Rolle<true>>;
        let sp: ServiceProvider<true>;
        let spMap: Map<string, ServiceProvider<true>>;

        beforeEach(() => {
            jest.resetAllMocks();
            personId = faker.string.uuid();
            rolleId = faker.string.uuid();
            event = new EmailAddressGeneratedEvent(personId, faker.string.uuid(), faker.internet.email(), true);

            personenkontexte = [createMock<Personenkontext<true>>()];
            rolle = createMock<Rolle<true>>({ serviceProviderIds: [] });
            rolleMap = new Map<string, Rolle<true>>();
            rolleMap.set(rolleId, rolle);
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: faker.internet.userName() });
            sp = createMock<ServiceProvider<true>>({
                kategorie: ServiceProviderKategorie.EMAIL,
            });
            spMap = new Map<string, ServiceProvider<true>>();
            spMap.set(sp.id, sp);
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            await sut.handlePersonenkontextCreatedEvent(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event');
            expect(oxServiceMock.send).not.toHaveBeenCalled();
        });

        it('should skip event, if no email is needed', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            sp = createMock<ServiceProvider<true>>({
                kategorie: ServiceProviderKategorie.VERWALTUNG,
            });
            spMap = new Map<string, ServiceProvider<true>>();
            spMap.set(sp.id, sp);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            personRepositoryMock.findById.mockResolvedValueOnce(undefined);

            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.info).toHaveBeenLastCalledWith(`Person with id:${personId} does not need an email`);
        });

        it('should log error when person already exists in OX', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            oxServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: {
                    exists: true,
                },
            });

            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(ExistsUserAction));
            expect(oxServiceMock.send).toHaveBeenCalledTimes(1);
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Cannot create user in OX, user with name:${person.vorname} already exists`,
            );
        });

        it('should log error when person cannot be found in DB', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            personRepositoryMock.findById.mockResolvedValueOnce(undefined);

            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Person not found for personId:${personId}`);
        });

        it('should log error when person has no email-address set', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            person.email = undefined;
            personRepositoryMock.findById.mockResolvedValueOnce(person);

            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenCalledTimes(0);
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Person with personId:${personId} has no email-address`);
        });

        it('should log info and publish OxUserCreatedEvent on success', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);

            personRepositoryMock.findById.mockResolvedValueOnce(person);

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
            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `User created in OX, userId:${fakeOXUserId}, email:${event.address}`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(1);
        });

        it('should log info on success and error when person has no referrer', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            person = createMock<Person<true>>({ email: faker.internet.email(), referrer: undefined });
            personRepositoryMock.findById.mockResolvedValueOnce(person);

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
            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(
                `User created in OX, userId:${fakeOXUserId}, email:${event.address}`,
            );
            expect(loggerMock.error).toHaveBeenLastCalledWith(
                `Person with personId:${personId} has no keycloakUsername/referrer: cannot create OXUserCreatedEvent`,
            );
            expect(eventServiceMock.publish).toHaveBeenCalledTimes(0);
        });

        it('should log error on failure', async () => {
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(rolleMap);
            serviceProviderRepoMock.findByIds.mockResolvedValueOnce(spMap);
            personRepositoryMock.findById.mockResolvedValueOnce(person);

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
            await sut.handlePersonenkontextCreatedEvent(event);

            expect(oxServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateUserAction));
            expect(loggerMock.error).toHaveBeenLastCalledWith(`Could not create user in OX, error: Request failed`);
        });
    });
});
