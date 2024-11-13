import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { HttpException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { Paged, PagedResponse } from '../../../shared/paging/index.js';
import { Personenstatus, SichtfreigabeType } from '../../personenkontext/domain/personenkontext.enums.js';
import { CreatePersonMigrationBodyParams } from './create-person.body.params.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { PersonController } from './person.controller.js';
import { PersonenQueryParams } from './personen-query.param.js';
import { PersonenkontextQueryParams } from '../../personenkontext/api/param/personenkontext-query.params.js';
import { PersonenkontextResponse } from '../../personenkontext/api/response/personenkontext.response.js';
import { UpdatePersonBodyParams } from './update-person.body.params.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { UsernameGeneratorService } from '../domain/username-generator.service.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { Person } from '../domain/person.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { KeycloakClientError } from '../../../shared/error/keycloak-client.error.js';
import { PersonFactory } from '../domain/person.factory.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationID } from '../../../shared/types/index.js';
import { EntityCouldNotBeDeleted, EntityNotFoundError, MismatchedRevisionError } from '../../../shared/error/index.js';
import { ConfigService } from '@nestjs/config';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { VornameForPersonWithTrailingSpaceError } from '../domain/vorname-with-trailing-space.error.js';
import { PersonenkontextService } from '../../personenkontext/domain/personenkontext.service.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonApiMapper } from '../mapper/person-api.mapper.js';
import { PersonDeleteService } from '../person-deletion/person-delete.service.js';
import { LockUserBodyParams } from './lock-user.body.params.js';
import { PersonDomainError } from '../domain/person-domain.error.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonMetadataBodyParams } from './person-metadata.body.param.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';
import { DBiamPersonenkontextService } from '../../personenkontext/domain/dbiam-personenkontext.service.js';
import { EventService } from '../../../core/eventbus/index.js';
import { PersonExternalSystemsSyncEvent } from '../../../shared/events/person-external-systems-sync.event.js';
import { NotFoundOrNoPermissionError } from '../domain/person-not-found-or-no-permission.error.js';
import { PersonalnummerRequiredError } from '../domain/personalnummer-required.error.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { PersonEmailResponse } from './person-email-response.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';
import { PersonLockOccasion } from '../domain/person.enums.js';

describe('PersonController', () => {
    let module: TestingModule;
    let personController: PersonController;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let emailRepoMock: DeepMocked<EmailRepo>;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;
    let personenkontextServiceMock: DeepMocked<PersonenkontextService>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let keycloakUserService: DeepMocked<KeycloakUserService>;
    let personDeleteServiceMock: DeepMocked<PersonDeleteService>;
    let personPermissionsMock: DeepMocked<PersonPermissions>;
    let dBiamPersonenkontextServiceMock: DeepMocked<DBiamPersonenkontextService>;
    let eventServiceMock: DeepMocked<EventService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonController,
                PersonFactory,
                PersonApiMapper,
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: PersonDeleteService,
                    useValue: createMock<PersonDeleteService>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: ConfigService,
                    useValue: createMock<ConfigService>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonenkontextService,
                    useValue: createMock<PersonenkontextService>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: DBiamPersonenkontextService,
                    useValue: createMock<DBiamPersonenkontextService>(),
                },
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
                {
                    provide: EmailRepo,
                    useValue: createMock<EmailRepo>(),
                },
            ],
        }).compile();
        personController = module.get(PersonController);
        personRepositoryMock = module.get(PersonRepository);
        emailRepoMock = module.get(EmailRepo);
        usernameGeneratorService = module.get(UsernameGeneratorService);
        personenkontextServiceMock = module.get(PersonenkontextService);
        rolleRepoMock = module.get(RolleRepo);
        personDeleteServiceMock = module.get(PersonDeleteService);
        keycloakUserService = module.get(KeycloakUserService);
        dBiamPersonenkontextServiceMock = module.get(DBiamPersonenkontextService);
        eventServiceMock = module.get(EventService);
    });

    function getPerson(): Person<true> {
        return Person.construct(
            faker.string.uuid(),
            faker.date.past(),
            faker.date.recent(),
            faker.person.lastName(),
            faker.person.firstName(),
            '1',
            faker.lorem.word(),
            faker.lorem.word(),
            faker.string.uuid(),
            undefined, // referrer
            undefined, // stammorganisation
            undefined, // initialenFamilienname
            undefined, // initialenVorname
            undefined, // rufname
            undefined, // nameTitel
            undefined, // nameAnrede
            undefined, // namePraefix
            undefined, // nameSuffix
            undefined, // nameSortierindex
            undefined, // geburtsdatum
            undefined, // geburtsort
            undefined, // geschlecht
            undefined, // lokalisierung
            undefined, // vertrauensstufe
            undefined, // auskunftssperre
            undefined, // personalnummer
            [
                {
                    person: '1',
                    locked_by: 'test',
                    locked_occasion: PersonLockOccasion.MANUELL_GESPERRT,
                    locked_until: new Date(),
                    created_at: new Date(),
                },
            ], // userLock array
            undefined, // orgUnassignmentDate
            undefined, // isLocked
            undefined, // email
        );
    }

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(personController).toBeDefined();
    });

    describe('createPersonMigration', () => {
        describe('when is authorized migration user', () => {
            it('should return PersonendatensatzResponse', async () => {
                const person: Person<true> = getPerson();
                const params: CreatePersonMigrationBodyParams = {
                    personId: faker.string.uuid(),
                    familienname: person.familienname,
                    vorname: person.vorname,
                    username: 'fixedusername',
                    hashedPassword: '{crypt}$6$TDByqqy.tqrqUUE0$px4z5v4gOTKY',
                };
                personPermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
                personRepositoryMock.create.mockResolvedValue(person);
                await expect(
                    personController.createPersonMigration(params, personPermissionsMock),
                ).resolves.toBeInstanceOf(PersonendatensatzResponse);
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(1);
                const result: PersonendatensatzResponse = await personController.createPersonMigration(
                    params,
                    personPermissionsMock,
                );
                expect(result.person.name.vorname).toEqual(person.vorname);
                expect(result.person.name.familienname).toEqual(person.familienname);
            });
        });
        describe('when is not authorized migration user', () => {
            it('should return error', async () => {
                const person: Person<true> = getPerson();
                const params: CreatePersonMigrationBodyParams = {
                    personId: faker.string.uuid(),
                    familienname: person.familienname,
                    vorname: person.vorname,
                    username: 'fixedusername',
                    hashedPassword: '{crypt}$6$TDByqqy.tqrqUUE0$px4z5v4gOTKY',
                };
                personPermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);
                personRepositoryMock.create.mockResolvedValue(person);
                await expect(personController.createPersonMigration(params, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
            });
        });
        describe('when creating a person is successful', () => {
            it('should return PersonendatensatzResponse', async () => {
                const person: Person<true> = getPerson();
                const params: CreatePersonMigrationBodyParams = {
                    personId: faker.string.uuid(),
                    familienname: person.familienname,
                    vorname: person.vorname,
                    username: 'fixedusername',
                    hashedPassword: '{crypt}$6$TDByqqy.tqrqUUE0$px4z5v4gOTKY',
                };
                personPermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
                personRepositoryMock.create.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
                await expect(
                    personController.createPersonMigration(params, personPermissionsMock),
                ).resolves.toBeInstanceOf(PersonendatensatzResponse);
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(1);
                const result: PersonendatensatzResponse = await personController.createPersonMigration(
                    params,
                    personPermissionsMock,
                );
                expect(result.person.name.vorname).toEqual(person.vorname);
                expect(result.person.name.familienname).toEqual(person.familienname);
            });
        });

        describe('when creating a person is not successful', () => {
            personPermissionsMock = createMock<PersonPermissions>();

            const params: CreatePersonMigrationBodyParams = {
                personId: faker.string.uuid(),
                familienname: faker.person.firstName(),
                vorname: faker.person.lastName(),
                username: 'fixedusername',
                hashedPassword: '{crypt}$6$TDByqqy.tqrqUUE0$px4z5v4gOTKY',
            };

            it('should throw HttpException when create operation fails', async () => {
                const person: Person<true> = getPerson();
                personPermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
                const orgaId: OrganisationID[] = [faker.string.uuid()];
                personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                    all: false,
                    orgaIds: orgaId,
                });
                usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: '' });
                personRepositoryMock.create.mockResolvedValue(new KeycloakClientError(''));
                await expect(personController.createPersonMigration(params, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(1);
            });

            it('should throw HttpException when familienname has trailing space', async () => {
                const person: Person<true> = getPerson();
                const bodyParams: CreatePersonMigrationBodyParams = {
                    personId: faker.string.uuid(),
                    familienname: 'familienname ',
                    vorname: faker.person.lastName(),
                    username: 'fixedusername',
                    hashedPassword: '{crypt}$6$TDByqqy.tqrqUUE0$px4z5v4gOTKY',
                };
                personPermissionsMock.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(personController.createPersonMigration(bodyParams, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('deletePerson', () => {
        const person: Person<true> = getPerson();
        const deleteParams: PersonByIdParams = {
            personId: person.id,
        };
        describe('when deleting a person is successful', () => {
            it('should return no error ', async () => {
                personDeleteServiceMock.deletePerson.mockResolvedValueOnce({
                    ok: true,
                    value: undefined,
                });
                const response: void = await personController.deletePersonById(deleteParams, personPermissionsMock);

                expect(response).toBeUndefined();
                expect(personDeleteServiceMock.deletePerson).toHaveBeenCalledTimes(1);
            });
        });
        describe('when deleting a person returns a SchulConnexError', () => {
            it('should throw HttpException', async () => {
                personDeleteServiceMock.deletePerson.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityCouldNotBeDeleted('entity', faker.string.uuid()),
                });
                await expect(personController.deletePersonById(deleteParams, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
            });
        });
    });

    describe('when getting a person', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        const person: Person<true> = getPerson();

        it('should get a person', async () => {
            personRepositoryMock.findById.mockResolvedValue(person);
            personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
            emailRepoMock.getEmailAddressAndStatusForPerson.mockResolvedValue(undefined);

            await expect(personController.findPersonById(params, personPermissionsMock)).resolves.not.toThrow();
        });

        it('should throw an HttpNotFoundException when permissions are insufficient', async () => {
            personRepositoryMock.findById.mockResolvedValue(undefined);
            personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                ok: false,
                error: new EntityNotFoundError(),
            });
            emailRepoMock.getEmailAddressAndStatusForPerson.mockResolvedValue(undefined);

            await expect(personController.findPersonById(params, personPermissionsMock)).rejects.toThrow(HttpException);
            expect(personRepositoryMock.findById).toHaveBeenCalledTimes(0);
        });

        describe('when person has an email-address assigned', () => {
            it('should get a person', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
                const fakeEmailAddress: string = faker.internet.email();
                emailRepoMock.getEmailAddressAndStatusForPerson.mockResolvedValue(
                    createMock<PersonEmailResponse>({
                        address: fakeEmailAddress,
                        status: EmailAddressStatus.ENABLED,
                    }),
                );
                const personResponse: PersonendatensatzResponse = await personController.findPersonById(
                    params,
                    personPermissionsMock,
                );

                if (!personResponse.person.email) throw Error();
                expect(personResponse.person.email.status).toStrictEqual(EmailAddressStatus.ENABLED);
                expect(personResponse.person.email.address).toStrictEqual(fakeEmailAddress);
            });
        });
    });

    describe('findPersons', () => {
        const options: {
            referrer: string;
            lastName: string;
            firstName: string;
        } = {
            referrer: faker.string.alpha(),
            lastName: faker.person.lastName(),
            firstName: faker.person.firstName(),
        };
        const queryParams: PersonenQueryParams = {
            referrer: options.referrer,
            familienname: options.lastName,
            vorname: options.firstName,
            sichtfreigabe: SichtfreigabeType.NEIN,
            suchFilter: '',
        };
        const person1: Person<true> = Person.construct(
            faker.string.uuid(),
            faker.date.past(),
            faker.date.recent(),
            faker.person.lastName(),
            'Moritz',
            '1',
            faker.lorem.word(),
            faker.lorem.word(),
            faker.string.uuid(),
        );
        const person2: Person<true> = Person.construct(
            faker.string.uuid(),
            faker.date.past(),
            faker.date.recent(),
            faker.person.lastName(),
            faker.person.firstName(),
            '1',
            faker.lorem.word(),
            faker.lorem.word(),
            faker.string.uuid(),
        );
        personPermissionsMock = createMock<PersonPermissions>();

        it('should get all persons', async () => {
            personRepositoryMock.findBy.mockResolvedValueOnce([[person1, person2], 2]);
            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce({ all: true });

            const result: PagedResponse<PersonendatensatzResponse> = await personController.findPersons(
                queryParams,
                personPermissionsMock,
            );
            expect(personRepositoryMock.findBy).toHaveBeenCalledTimes(1);
            expect(result.total).toEqual(2);
            expect(result.limit).toEqual(2);
            expect(result.offset).toEqual(0);
            expect(result.items.length).toEqual(2);
            expect(result.items.at(0)?.person.name.vorname).toEqual('Moritz');
        });

        it('should get all persons when organisationIds is found and is ROOT', async () => {
            personRepositoryMock.findBy.mockResolvedValueOnce([[person1, person2], 2]);
            personPermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce({
                all: false,
                orgaIds: [personController.ROOT_ORGANISATION_ID],
            });
            const result: PagedResponse<PersonendatensatzResponse> = await personController.findPersons(
                queryParams,
                personPermissionsMock,
            );
            expect(personRepositoryMock.findBy).toHaveBeenCalledTimes(1);
            expect(result.total).toEqual(2);
            expect(result.limit).toEqual(2);
            expect(result.offset).toEqual(0);
            expect(result.items.length).toEqual(2);
            expect(result.items.at(0)?.person.name.vorname).toEqual('Moritz');
        });
    });

    describe('createPersonenkontext', () => {
        it('should throw NotImplemented error', () => {
            expect(() => personController.createPersonenkontext()).toThrow(NotImplementedException);
        });
    });

    describe('findPersonenkontexte', () => {
        describe('When fetching personenkontexte is successful', () => {
            it('should get all personenkontexte', async () => {
                const pathParams: PersonByIdParams = {
                    personId: faker.string.uuid(),
                };
                const queryParams: PersonenkontextQueryParams = {
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.NEIN,
                    personenstatus: Personenstatus.AKTIV,
                };
                const personenkontextResponse: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    getRolle: () => rolleRepoMock.findById(faker.string.uuid()),
                });
                const personenkontextDtos: Paged<Personenkontext<true>> = {
                    items: [personenkontextResponse],
                    total: 1,
                    offset: 0,
                    limit: 1,
                };
                personPermissionsMock = createMock<PersonPermissions>();

                personenkontextServiceMock.findAllPersonenkontexte.mockResolvedValue(personenkontextDtos);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: getPerson() });

                const result: PagedResponse<PersonenkontextResponse> = await personController.findPersonenkontexte(
                    pathParams,
                    queryParams,
                    personPermissionsMock,
                );

                expect(result.items.length).toBe(1);
                expect(result.items[0]?.id).toBe(personenkontextDtos.items[0]?.id);
            });
        });

        describe('when permissions are insufficient to fetch personenkontexte', () => {
            it('should throw HttpNotFoundException', async () => {
                const pathParams: PersonByIdParams = {
                    personId: faker.string.uuid(),
                };
                const queryParams: PersonenkontextQueryParams = {
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.NEIN,
                    personenstatus: Personenstatus.AKTIV,
                };
                const personenkontextResponse: Personenkontext<true> = DoFactory.createPersonenkontext(true);

                const personenkontextDtos: Paged<Personenkontext<true>> = {
                    items: [personenkontextResponse],
                    total: 1,
                    offset: 0,
                    limit: 1,
                };
                personPermissionsMock = createMock<PersonPermissions>();

                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });
                personenkontextServiceMock.findAllPersonenkontexte.mockResolvedValue(personenkontextDtos);
                await expect(
                    personController.findPersonenkontexte(pathParams, queryParams, personPermissionsMock),
                ).rejects.toThrow(HttpException);
            });
        });
    });

    describe('resetPasswordByPersonId', () => {
        describe('when resetting password for a person', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };
            const person: Person<true> = getPerson();
            personPermissionsMock = createMock<PersonPermissions>();

            it('should reset password for person', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(
                    personController.resetPasswordByPersonId(params, personPermissionsMock),
                ).resolves.not.toThrow();
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when resetting password for a person returns a SchulConnexError', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };
            const person: Person<true> = getPerson();
            personPermissionsMock = createMock<PersonPermissions>();

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(new KeycloakClientError(''));
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(personController.resetPasswordByPersonId(params, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person does not exist', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };
            const person: Person<true> = getPerson();
            personPermissionsMock = createMock<PersonPermissions>();

            it('should throw HttpException', async () => {
                personRepositoryMock.findBy.mockResolvedValue([[], 0]);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });

                await expect(personController.resetPasswordByPersonId(params, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });

        describe('when permissions are insufficient to reset user-password', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };
            const person: Person<true> = getPerson();
            personPermissionsMock = createMock<PersonPermissions>();

            it('should throw HttpNotFoundException', async () => {
                personRepositoryMock.findById.mockResolvedValue(undefined);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });

                await expect(personController.resetPasswordByPersonId(params, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });
    });

    describe('updatePerson', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        const body: UpdatePersonBodyParams = {
            stammorganisation: faker.string.uuid(),
            referrer: 'referrer',
            name: {
                vorname: 'john',
                familienname: 'doe',
            },
            geburt: {},
            lokalisierung: 'de-DE',
            revision: '1',
        };
        personPermissionsMock = createMock<PersonPermissions>();

        describe('when updating a person is successful', () => {
            const person: Person<true> = getPerson();

            it('should return PersonendatensatzResponse', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(
                    personController.updatePerson(params, body, personPermissionsMock),
                ).resolves.toBeInstanceOf(PersonendatensatzResponse);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person does not exist', () => {
            const person: Person<true> = getPerson();

            it('should throw HttpException', async () => {
                personRepositoryMock.findBy.mockResolvedValue([[], 0]);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });

                await expect(personController.updatePerson(params, body, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });

        describe('when revision does not match', () => {
            const person: Person<true> = getPerson();
            person.revision = '10';

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(personController.updatePerson(params, body, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                //expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });

        describe('when permissions are insufficient to update user', () => {
            const person: Person<true> = getPerson();
            person.revision = '10';

            it('should throw HttpNotFoundException', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError(),
                });

                await expect(personController.updatePerson(params, body, personPermissionsMock)).rejects.toThrow(
                    HttpException,
                );
                expect(personRepositoryMock.findById).toHaveBeenCalledTimes(0);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });

        describe('when updated vorname has trailing space', () => {
            const person: Person<true> = getPerson();
            const bodyParams: UpdatePersonBodyParams = {
                stammorganisation: faker.string.uuid(),
                referrer: 'referrer',
                name: {
                    vorname: ' john',
                    familienname: 'doe',
                },
                geburt: {},
                lokalisierung: 'de-DE',
                revision: '1',
            };

            it('should throw VornameForPersonWithTrailingSpaceError', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await expect(personController.updatePerson(params, bodyParams, personPermissionsMock)).rejects.toThrow(
                    VornameForPersonWithTrailingSpaceError,
                );
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });
    });
    describe('lockPerson', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        personPermissionsMock = createMock<PersonPermissions>();

        describe('when locking a user is successful', () => {
            const person: Person<true> = getPerson();
            const lockUserBodyParams: LockUserBodyParams = {
                lock: true,
                locked_by: 'Theo Tester',
                locked_until: new Date(),
            };
            it('should return a success message', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
                keycloakUserService.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });

                const response: { message: string } = await personController.lockPerson(
                    params.personId,
                    lockUserBodyParams,
                    personPermissionsMock,
                );

                expect(response).toEqual({ message: 'User has been successfully locked.' });
                expect(personRepositoryMock.getPersonIfAllowed).toHaveBeenCalledTimes(1);
                expect(keycloakUserService.updateKeycloakUserStatus).toHaveBeenCalledTimes(1);
            });
        });

        describe('when unlocking a user is successful', () => {
            const person: Person<true> = getPerson();
            const lockUserBodyParams: LockUserBodyParams = {
                lock: false,
                locked_by: 'Theo Tester',
                locked_until: new Date(),
            };
            it('should return a success message', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });
                keycloakUserService.updateKeycloakUserStatus.mockResolvedValueOnce({ ok: true, value: undefined });

                const response: { message: string } = await personController.lockPerson(
                    params.personId,
                    lockUserBodyParams,
                    personPermissionsMock,
                );

                expect(response).toEqual({ message: 'User has been successfully unlocked.' });
                expect(personRepositoryMock.getPersonIfAllowed).toHaveBeenCalledTimes(1);
                expect(keycloakUserService.updateKeycloakUserStatus).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person does not exist or no permissions', () => {
            const lockUserBodyParams: LockUserBodyParams = {
                lock: false,
                locked_by: '2024-01-01T00:00:00Z',
                locked_until: new Date(),
            };
            it('should throw an error', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: false,
                    error: new EntityNotFoundError('Person'),
                });
                await expect(
                    personController.lockPerson(params.personId, lockUserBodyParams, personPermissionsMock),
                ).rejects.toThrow(PersonDomainError);
            });
        });

        describe('when keycloakUserId is missing', () => {
            const lockUserBodyParams: LockUserBodyParams = {
                lock: false,
                locked_by: '2024-01-01T00:00:00Z',
                locked_until: new Date(),
            };
            const person: Person<true> = getPerson();
            person.keycloakUserId = undefined;

            it('should throw an error', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: true,
                    value: person,
                });
                await expect(
                    personController.lockPerson(params.personId, lockUserBodyParams, personPermissionsMock),
                ).rejects.toThrow(PersonDomainError);
            });
        });

        describe('when updating user status fails', () => {
            const person: Person<true> = getPerson();
            person.keycloakUserId = 'keycloak-12345';

            it('should throw an error', async () => {
                const lockUserBodyParams: LockUserBodyParams = {
                    lock: false,
                    locked_by: '2024-01-01T00:00:00Z',
                    locked_until: new Date(),
                };
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({
                    ok: true,
                    value: person,
                });
                keycloakUserService.updateKeycloakUserStatus.mockResolvedValueOnce({
                    ok: false,
                    error: new KeycloakClientError('Could not update user status or custom attributes'),
                });
                await expect(
                    personController.lockPerson(params.personId, lockUserBodyParams, personPermissionsMock),
                ).rejects.toThrow(PersonDomainError);
            });
        });
    });

    describe('syncPerson', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        personPermissionsMock = createMock<PersonPermissions>();

        describe('when person exists and user has permissions', () => {
            const person: Person<true> = getPerson();
            it('should publish event', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: true, value: person });

                await personController.syncPerson(params.personId, personPermissionsMock);

                expect(personRepositoryMock.getPersonIfAllowed).toHaveBeenCalledTimes(1);
                expect(eventServiceMock.publish).toHaveBeenCalledWith(expect.any(PersonExternalSystemsSyncEvent));
            });
        });

        describe('when person does not exists or user is missing permissions', () => {
            it('should return error', async () => {
                personRepositoryMock.getPersonIfAllowed.mockResolvedValueOnce({ ok: false, error: createMock() });

                const syncPromise: Promise<void> = personController.syncPerson(params.personId, personPermissionsMock);

                await expect(syncPromise).rejects.toEqual(new NotFoundOrNoPermissionError(params.personId));
                expect(personRepositoryMock.getPersonIfAllowed).toHaveBeenCalledTimes(1);
                expect(eventServiceMock.publish).not.toHaveBeenCalled();
            });
        });
    });

    describe('updateMetadata', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        const body: PersonMetadataBodyParams = {
            familienname: faker.name.lastName(),
            vorname: faker.name.firstName(),
            personalnummer: faker.finance.pin(7),
            lastModified: faker.date.recent(),
            revision: '1',
        };

        it('should return 200 when successful', async () => {
            const person: Person<true> = getPerson();
            person.personalnummer = body.personalnummer;
            dBiamPersonenkontextServiceMock.isPersonalnummerRequiredForAnyPersonenkontextForPerson.mockResolvedValueOnce(
                true,
            );
            personRepositoryMock.updatePersonMetadata.mockResolvedValue(person);
            await expect(personController.updateMetadata(params, body, personPermissionsMock)).resolves.toBeInstanceOf(
                PersonendatensatzResponse,
            );
            expect(personRepositoryMock.updatePersonMetadata).toHaveBeenCalledTimes(1);
        });

        it('should throw DuplicatePersonalnummerError when Personalnummer is already assigned', async () => {
            dBiamPersonenkontextServiceMock.isPersonalnummerRequiredForAnyPersonenkontextForPerson.mockResolvedValueOnce(
                true,
            );
            personRepositoryMock.updatePersonMetadata.mockResolvedValue(
                new DuplicatePersonalnummerError('Personalnummer already exists'),
            );
            await expect(personController.updateMetadata(params, body, personPermissionsMock)).rejects.toThrow(
                DuplicatePersonalnummerError,
            );
        });

        it('should throw PersonalnummerRequiredError when personalnummer was not provided and faminlienname or vorname did not change', async () => {
            const person: Person<true> = getPerson();
            const bodyWithInvalidPersonalnummer: PersonMetadataBodyParams = {
                familienname: person.familienname,
                vorname: person.vorname,
                personalnummer: '',
                lastModified: faker.date.recent(),
                revision: '1',
            };
            dBiamPersonenkontextServiceMock.isPersonalnummerRequiredForAnyPersonenkontextForPerson.mockResolvedValueOnce(
                true,
            );
            personRepositoryMock.updatePersonMetadata.mockResolvedValue(new PersonalnummerRequiredError());
            await expect(
                personController.updateMetadata(params, bodyWithInvalidPersonalnummer, personPermissionsMock),
            ).rejects.toThrow(PersonalnummerRequiredError);
        });

        it('should throw HttpException when revision is incorrect', async () => {
            const bodyWithInvalidRevision: PersonMetadataBodyParams = {
                familienname: faker.name.lastName(),
                vorname: faker.name.firstName(),
                personalnummer: '',
                lastModified: faker.date.recent(),
                revision: '2',
            };
            dBiamPersonenkontextServiceMock.isPersonalnummerRequiredForAnyPersonenkontextForPerson.mockResolvedValueOnce(
                true,
            );
            personRepositoryMock.updatePersonMetadata.mockResolvedValue(new MismatchedRevisionError(''));
            await expect(
                personController.updateMetadata(params, bodyWithInvalidRevision, personPermissionsMock),
            ).rejects.toThrow(HttpException);
        });

        it('should throw PersonDomainError when Person has no personenkontexte where a rolle requires a KoPers.', async () => {
            dBiamPersonenkontextServiceMock.isPersonalnummerRequiredForAnyPersonenkontextForPerson.mockResolvedValueOnce(
                false,
            );
            await expect(personController.updateMetadata(params, body, personPermissionsMock)).rejects.toThrow(
                PersonDomainError,
            );
        });
    });
});
