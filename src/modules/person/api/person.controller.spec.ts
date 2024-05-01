import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MapperTestModule } from '../../../../test/utils/index.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { Paged, PagedResponse } from '../../../shared/paging/index.js';
import {
    Jahrgangsstufe,
    Personenstatus,
    Rolle,
    SichtfreigabeType,
} from '../../personenkontext/domain/personenkontext.enums.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonenkontextBodyParams } from '../../personenkontext/api/create-personenkontext.body.params.js';
import { CreatedPersonenkontextDto } from '../../personenkontext/api/created-personenkontext.dto.js';
import { PersonApiMapperProfile } from './person-api.mapper.profile.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { PersonController } from './person.controller.js';
import { PersonenQueryParams } from './personen-query.param.js';
import { PersonenkontextQueryParams } from '../../personenkontext/api/personenkontext-query.params.js';
import { PersonenkontextDto } from '../../personenkontext/api/personenkontext.dto.js';
import { PersonenkontextResponse } from '../../personenkontext/api/personenkontext.response.js';
import { PersonenkontextUc } from '../../personenkontext/api/personenkontext.uc.js';
import { UpdatePersonBodyParams } from './update-person.body.params.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { UsernameGeneratorService } from '../domain/username-generator.service.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { Person } from '../domain/person.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { KeycloakClientError } from '../../../shared/error/keycloak-client.error.js';
import { PersonFactory } from '../domain/person.factory.js';

describe('PersonController', () => {
    let module: TestingModule;
    let personController: PersonController;
    let personenkontextUcMock: DeepMocked<PersonenkontextUc>;
    let personRepositoryMock: DeepMocked<PersonRepository>;
    let usernameGeneratorService: DeepMocked<UsernameGeneratorService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonController,
                PersonFactory,
                PersonApiMapperProfile,
                {
                    provide: PersonenkontextUc,
                    useValue: createMock<PersonenkontextUc>(),
                },
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
                {
                    provide: KeycloakUserService,
                    useValue: createMock<KeycloakUserService>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: UsernameGeneratorService,
                    useValue: createMock<UsernameGeneratorService>(),
                },
            ],
        }).compile();
        personController = module.get(PersonController);
        personenkontextUcMock = module.get(PersonenkontextUc);
        personRepositoryMock = module.get(PersonRepository);
        usernameGeneratorService = module.get(UsernameGeneratorService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(personController).toBeDefined();
    });

    describe('createPerson', () => {
        describe('when creating a person is successful', () => {
            it('should return PersonendatensatzResponse', async () => {
                const firstName: string = faker.person.firstName();
                const lastName: string = faker.person.lastName();

                const person: Person<true> = Person.construct(
                    faker.string.uuid(),
                    faker.date.past(),
                    faker.date.recent(),
                    lastName,
                    firstName,
                    '1',
                    faker.lorem.word(),
                    faker.lorem.word(),
                    faker.string.uuid(),
                );
                const params: CreatePersonBodyParams = {
                    name: {
                        vorname: firstName,
                        familienname: lastName,
                    },
                    geburt: {},
                };

                personRepositoryMock.create.mockResolvedValue(person);

                await expect(personController.createPerson(params)).resolves.toBeInstanceOf(PersonendatensatzResponse);
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(1);
                const result: PersonendatensatzResponse = await personController.createPerson(params);
                expect(result.person.name.vorname).toEqual(firstName);
                expect(result.person.name.familienname).toEqual(lastName);
            });
        });

        describe('when creating a person is not successful', () => {
            const params: CreatePersonBodyParams = {
                name: {
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                },
                geburt: {},
            };

            it('should throw HttpException', async () => {
                usernameGeneratorService.generateUsername.mockResolvedValue({ ok: true, value: '' });
                personRepositoryMock.create.mockResolvedValue(new KeycloakClientError(''));
                await expect(personController.createPerson(params)).rejects.toThrow(HttpException);
                expect(personRepositoryMock.create).toHaveBeenCalledTimes(1);
            });

            it('should throw HttpException', async () => {
                usernameGeneratorService.generateUsername.mockResolvedValue({
                    ok: false,
                    error: new KeycloakClientError(''),
                });
                await expect(personController.createPerson(params)).rejects.toThrow(HttpException);
                expect(personRepositoryMock.create).not.toHaveBeenCalled();
            });
        });
    });

    describe('when getting a person', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        const person: Person<true> = Person.construct(
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

        it('should get a person', async () => {
            personRepositoryMock.findById.mockResolvedValue(person);
            await expect(personController.findPersonById(params)).resolves.not.toThrow();
            expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
        });

        it('should throw an Http not found exception', async () => {
            personRepositoryMock.findById.mockResolvedValue(undefined);
            await expect(personController.findPersonById(params)).rejects.toThrow(HttpException);
            expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
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

        it('should get all persons', async () => {
            personRepositoryMock.findBy.mockResolvedValue([[person1, person2], 2]);

            const result: PagedResponse<PersonendatensatzResponse> = await personController.findPersons(queryParams);
            expect(personRepositoryMock.findBy).toHaveBeenCalledTimes(1);
            expect(result.total).toEqual(2);
            expect(result.limit).toEqual(2);
            expect(result.offset).toEqual(0);
            expect(result.items.length).toEqual(2);
            expect(result.items.at(0)?.person.name.vorname).toEqual('Moritz');
        });
    });

    describe('createPersonenkontext', () => {
        describe('when creating a personenkontext is successful', () => {
            it('should not throw', async () => {
                const pathParams: PersonByIdParams = {
                    personId: faker.string.uuid(),
                };
                const body: CreatePersonenkontextBodyParams = {
                    rolle: Rolle.LEHRENDER,
                    jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                    personenstatus: Personenstatus.AKTIV,
                    referrer: 'referrer',
                };
                const ucResult: CreatedPersonenkontextDto = {
                    id: faker.string.uuid(),
                    mandant: faker.string.uuid(),
                    organisation: {
                        id: faker.string.uuid(),
                    },
                    revision: '1',
                    rolle: Rolle.LEHRENDER,
                    jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                    personenstatus: Personenstatus.AKTIV,
                    referrer: 'referrer',
                    loeschung: { zeitpunkt: faker.date.past() },
                };
                personenkontextUcMock.createPersonenkontext.mockResolvedValue(ucResult);

                await expect(personController.createPersonenkontext(pathParams, body)).resolves.toBeInstanceOf(
                    PersonenkontextResponse,
                );
                expect(personenkontextUcMock.createPersonenkontext).toHaveBeenCalledTimes(1);
            });
        });

        describe('when creating a personenkontext returns a SchulConnexError', () => {
            it('should throw HttpException', async () => {
                const pathParams: PersonByIdParams = {
                    personId: faker.string.uuid(),
                };
                const body: CreatePersonenkontextBodyParams = {
                    rolle: Rolle.LEHRENDER,
                    jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                    personenstatus: Personenstatus.AKTIV,
                    referrer: 'referrer',
                };
                personenkontextUcMock.createPersonenkontext.mockResolvedValue(
                    new SchulConnexError({} as SchulConnexError),
                );

                await expect(personController.createPersonenkontext(pathParams, body)).rejects.toThrow(HttpException);
                expect(personenkontextUcMock.createPersonenkontext).toHaveBeenCalledTimes(1);
            });
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
                    rolle: Rolle.LERNENDER,
                };
                const personenkontextResponse: PersonenkontextDto = {
                    id: faker.string.uuid(),
                    personId: faker.string.uuid(),
                    organisation: {
                        id: faker.string.uuid(),
                    },
                    revision: '1',
                    mandant: faker.string.uuid(),
                    rolle: Rolle.LERNENDER,
                    referrer: 'referrer',
                    jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                    personenstatus: Personenstatus.AKTIV,
                    loeschung: { zeitpunkt: faker.date.past() },
                };
                const personenkontextDtos: Paged<PersonenkontextDto> = {
                    items: [personenkontextResponse],
                    total: 1,
                    offset: 0,
                    limit: 1,
                };

                personenkontextUcMock.findAll.mockResolvedValue(personenkontextDtos);

                const result: PagedResponse<PersonenkontextResponse> = await personController.findPersonenkontexte(
                    pathParams,
                    queryParams,
                );

                expect(personenkontextUcMock.findAll).toHaveBeenCalledTimes(1);
                expect(result.items.length).toBe(1);
                expect(result.items[0]?.id).toBe(personenkontextDtos.items[0]?.id);
            });
        });
    });

    describe('resetPasswordByPersonId', () => {
        describe('when resetting password for a person', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };

            const person: Person<true> = Person.construct(
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

            it('should reset password for person', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);
                await expect(personController.resetPasswordByPersonId(params)).resolves.not.toThrow();
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when resetting password for a person returns a SchulConnexError', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };

            const person: Person<true> = Person.construct(
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

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(new KeycloakClientError(''));
                await expect(personController.resetPasswordByPersonId(params)).rejects.toThrow(HttpException);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person does not exist', () => {
            const params: PersonByIdParams = {
                personId: faker.string.uuid(),
            };

            const person: Person<true> = Person.construct(
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

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(undefined);
                personRepositoryMock.update.mockResolvedValue(person);
                await expect(personController.resetPasswordByPersonId(params)).rejects.toThrow(HttpException);
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

        describe('when updating a person is successful', () => {
            const person: Person<true> = Person.construct(
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

            it('should return PersonendatensatzResponse', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);

                await expect(personController.updatePerson(params, body)).resolves.toBeInstanceOf(
                    PersonendatensatzResponse,
                );
                expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(1);
            });
        });

        describe('when person does not exist', () => {
            const person: Person<true> = Person.construct(
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

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(undefined);
                personRepositoryMock.update.mockResolvedValue(person);

                await expect(personController.updatePerson(params, body)).rejects.toThrow(HttpException);
                expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });

        describe('when revision does not match', () => {
            const person: Person<true> = Person.construct(
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
            person.revision = '10';

            it('should throw HttpException', async () => {
                personRepositoryMock.findById.mockResolvedValue(person);
                personRepositoryMock.update.mockResolvedValue(person);

                await expect(personController.updatePerson(params, body)).rejects.toThrow(HttpException);
                expect(personRepositoryMock.findById).toHaveBeenCalledTimes(1);
                expect(personRepositoryMock.update).toHaveBeenCalledTimes(0);
            });
        });
    });
});
