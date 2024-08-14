import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { SchuleCreatedEvent } from '../../../shared/events/schule-created.event.js';
import { OrganisationID } from '../../../shared/types/index.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { ItsLearningOrganisationsEventHandler } from './itslearning-organisations.event-handler.js';
import { ItsLearningIMSESService } from '../itslearning.service.js';
import { ConfigService } from '@nestjs/config';
import { ItsLearningConfig, ServerConfig } from '../../../shared/config/index.js';
import { CreateGroupAction } from '../actions/create-group.action.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { KlasseCreatedEvent } from '../../../shared/events/klasse-created.event.js';

describe('ItsLearning Organisations Event Handler', () => {
    let module: TestingModule;

    let sut: ItsLearningOrganisationsEventHandler;
    let orgaRepoMock: DeepMocked<OrganisationRepository>;
    let itsLearningServiceMock: DeepMocked<ItsLearningIMSESService>;
    let loggerMock: DeepMocked<ClassLogger>;

    let configRootOeffentlich: string;
    let configRootErsatz: string;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule, ConfigTestModule],
            providers: [
                ItsLearningOrganisationsEventHandler,
                {
                    provide: ItsLearningIMSESService,
                    useValue: createMock<ItsLearningIMSESService>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
            ],
        }).compile();

        sut = module.get(ItsLearningOrganisationsEventHandler);
        orgaRepoMock = module.get(OrganisationRepository);
        itsLearningServiceMock = module.get(ItsLearningIMSESService);
        loggerMock = module.get(ClassLogger);

        const config: ConfigService<ServerConfig> = module.get(ConfigService);
        configRootOeffentlich = config.getOrThrow<ItsLearningConfig>('ITSLEARNING').ROOT_OEFFENTLICH;
        configRootErsatz = config.getOrThrow<ItsLearningConfig>('ITSLEARNING').ROOT_ERSATZ;
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        sut.ENABLED = true;
        jest.resetAllMocks();
    });

    describe('createSchuleEventHandler', () => {
        it('should log on success', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const schuleName: OrganisationID = faker.word.noun();
            const oldParentId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({
                    id: orgaId,
                    typ: OrganisationsTyp.SCHULE,
                    name: schuleName,
                    administriertVon: configRootOeffentlich,
                }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
            );
            orgaRepoMock.findRootDirectChildren.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            ]);
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: { parentId: oldParentId } }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createSchuleEventHandler(event);

            expect(itsLearningServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateGroupAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(`Schule with ID ${orgaId} created.`);
        });

        it('should keep existing hierarchy', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const schuleName: OrganisationID = faker.word.noun();
            const oldParentId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({
                    typ: OrganisationsTyp.SCHULE,
                    name: schuleName,
                    administriertVon: configRootOeffentlich,
                }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
            );
            orgaRepoMock.findRootDirectChildren.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            ]);
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: { parentId: oldParentId } }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createSchuleEventHandler(event);

            expect(itsLearningServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateGroupAction));
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(faker.string.uuid());

            await sut.createSchuleEventHandler(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event.');
            expect(orgaRepoMock.findById).not.toHaveBeenCalled();
            expect(itsLearningServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error, if the organisation does not exist', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(undefined);

            await sut.createSchuleEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith(`Organisation with id ${orgaId} could not be found!`);
            expect(itsLearningServiceMock.send).not.toHaveBeenCalled();
        });

        it('should skip event, if orga is not schule', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ typ: OrganisationsTyp.UNBEST }),
            );

            await sut.createSchuleEventHandler(event);

            expect(itsLearningServiceMock.send).not.toHaveBeenCalled();
        });

        it('should skip event, if schule is ersatzschule', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({
                    typ: OrganisationsTyp.SCHULE,
                    administriertVon: configRootOeffentlich,
                }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            );
            orgaRepoMock.findRootDirectChildren.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            ]);

            await sut.createSchuleEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith(`Ersatzschule, ignoring.`);
            expect(itsLearningServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error on failed creation', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const schuleName: OrganisationID = faker.word.noun();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({
                    typ: OrganisationsTyp.SCHULE,
                    name: schuleName,
                    administriertVon: configRootOeffentlich,
                }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
            );
            orgaRepoMock.findRootDirectChildren.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            ]);
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: createMock() }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock<DomainError>({ message: 'Error' }),
            }); // CreateGroupAction

            await sut.createSchuleEventHandler(event);

            expect(loggerMock.error).toHaveBeenLastCalledWith(`Could not create Schule in itsLearning: Error`);
        });

        it('should use "Öffentlich" as default, when no parent can be found', async () => {
            const orgaId: OrganisationID = faker.string.uuid();
            const event: SchuleCreatedEvent = new SchuleCreatedEvent(orgaId);
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({
                    typ: OrganisationsTyp.SCHULE,
                    administriertVon: configRootOeffentlich,
                    name: undefined,
                }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(
                createMock<Organisation<true>>({ id: faker.string.uuid(), administriertVon: configRootOeffentlich }),
            );
            orgaRepoMock.findById.mockResolvedValueOnce(undefined);
            orgaRepoMock.findRootDirectChildren.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: configRootOeffentlich, typ: OrganisationsTyp.LAND }),
                createMock<Organisation<true>>({ id: configRootErsatz, typ: OrganisationsTyp.LAND }),
            ]);
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock(),
            }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createSchuleEventHandler(event);
        });
    });

    describe('createKlasseEventHandler', () => {
        it('should log on success', async () => {
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                faker.string.alphanumeric(),
                faker.string.uuid(),
            );
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: {} }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: true,
                value: undefined,
            }); // CreateGroupAction

            await sut.createKlasseEventHandler(event);

            expect(itsLearningServiceMock.send).toHaveBeenLastCalledWith(expect.any(CreateGroupAction));
            expect(loggerMock.info).toHaveBeenLastCalledWith(`Klasse with ID ${event.id} created.`);
        });

        it('should skip event, if not enabled', async () => {
            sut.ENABLED = false;
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                faker.string.alphanumeric(),
                faker.string.uuid(),
            );

            await sut.createKlasseEventHandler(event);

            expect(loggerMock.info).toHaveBeenCalledWith('Not enabled, ignoring event.');
            expect(itsLearningServiceMock.send).not.toHaveBeenCalled();
        });

        it('should log error, if administriertVon is undefined', async () => {
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                faker.string.alphanumeric(),
                undefined,
            );

            await sut.createKlasseEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith('Klasse has no parent organisation. Aborting.');
        });

        it('should log error, if the klasse has no name', async () => {
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                undefined,
                faker.string.uuid(),
            );

            await sut.createKlasseEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith('Klasse has no name. Aborting.');
        });

        it('should log error, if the parent school does not exist', async () => {
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                faker.string.alphanumeric(),
                faker.string.uuid(),
            );
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: false, error: createMock() }); // ReadGroupAction

            await sut.createKlasseEventHandler(event);

            expect(loggerMock.error).toHaveBeenCalledWith(
                `Parent Organisation (${event.administriertVon}) does not exist in itsLearning.`,
            );
        });

        it('should log error on failed creation', async () => {
            const event: KlasseCreatedEvent = new KlasseCreatedEvent(
                faker.string.uuid(),
                faker.string.alphanumeric(),
                faker.string.uuid(),
            );
            itsLearningServiceMock.send.mockResolvedValueOnce({ ok: true, value: {} }); // ReadGroupAction
            itsLearningServiceMock.send.mockResolvedValueOnce({
                ok: false,
                error: createMock<DomainError>({ message: 'Error' }),
            }); // CreateGroupAction

            await sut.createKlasseEventHandler(event);
            expect(loggerMock.error).toHaveBeenLastCalledWith('Could not create Klasse in itsLearning: Error');
        });
    });
});
