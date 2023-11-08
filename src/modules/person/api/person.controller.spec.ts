import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { MapperTestModule } from '../../../../test/utils/index.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { PersonApiMapperProfile } from './person-api.mapper.profile.js';
import { PersonController } from './person.controller.js';
import { PersonUc } from './person.uc.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { HttpException } from '@nestjs/common';
import { PersonenQueryParams, SichtfreigabeType } from './personen-query.param.js';
import { PersonBirthParams } from './person-birth.params.js';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonenkontextUc } from './personenkontext.uc.js';
import { CreatePersonenkontextBodyParams } from './create-personenkontext.body.params.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { Jahrgangsstufe, Personenstatus, Rolle } from '../domain/personenkontext.enums.js';
import { PagedResponse } from '../../../shared/paging/index.js';
import { PersonenkontextResponse } from './personenkontext.response.js';
import { PersonenkontextQueryParams } from './personenkontext-query.params.js';
import { PersonendatensatzDto } from './personendatensatz.dto.js';
import { PersonDto } from './person.dto.js';
import { PersonenkontextDto } from './personenkontext.dto.js';

describe('PersonController', () => {
    let module: TestingModule;
    let personController: PersonController;
    let personUcMock: DeepMocked<PersonUc>;
    let personenkontextUcMock: DeepMocked<PersonenkontextUc>;
    const mockBirthParams: PersonBirthParams = {
        datum: faker.date.anytime(),
        geburtsort: faker.string.alpha(),
    };

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonController,
                PersonApiMapperProfile,
                {
                    provide: PersonUc,
                    useValue: createMock<PersonUc>(),
                },
                {
                    provide: PersonenkontextUc,
                    useValue: createMock<PersonenkontextUc>(),
                },
            ],
        }).compile();
        personController = module.get(PersonController);
        personUcMock = module.get(PersonUc);
        personenkontextUcMock = module.get(PersonenkontextUc);
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

    describe('when creating a person', () => {
        it('should not throw', async () => {
            personUcMock.createPerson.mockResolvedValue();
            const params: CreatePersonBodyParams = {
                username: faker.internet.userName(),
                mandant: faker.string.uuid(),
                name: {
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                },
                geburt: {},
            };
            await expect(personController.createPerson(params)).resolves.not.toThrow();
            expect(personUcMock.createPerson).toHaveBeenCalledTimes(1);
        });
    });
    describe('when getting a person', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };

        it('should get a person', async () => {
            const personDto: PersonDto = {} as PersonDto;
            const persondatensatzDto: PersonendatensatzDto = {
                person: personDto,
                personenkontexte: [],
            };

            personUcMock.findPersonById.mockResolvedValue(persondatensatzDto);

            await expect(personController.findPersonById(params)).resolves.not.toThrow();

            expect(personUcMock.findPersonById).toHaveBeenCalledTimes(1);
        });

        it('should throw an Http not found exception', async () => {
            const mockError: Error = new Error('person does not exist.');
            personUcMock.findPersonById.mockRejectedValue(mockError);
            await expect(personController.findPersonById(params)).rejects.toThrowError(HttpException);
            expect(personUcMock.findPersonById).toHaveBeenCalledTimes(1);
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
        };

        it('should get all persons', async () => {
            const person1: PersonDto = {
                id: faker.string.uuid(),
                name: {
                    familienname: options.lastName,
                    vorname: options.firstName,
                },
                referrer: options.referrer,
                geburt: mockBirthParams,
                geschlecht: Geschlecht.M,
                lokalisierung: '',
                vertrauensstufe: Vertrauensstufe.VOLL,
            } as PersonDto;
            const person2: PersonDto = {
                id: faker.string.uuid(),
                name: {
                    familienname: options.lastName,
                    vorname: options.firstName,
                },
                referrer: options.referrer,
                geburt: mockBirthParams,
                geschlecht: Geschlecht.M,
                lokalisierung: '',
                vertrauensstufe: Vertrauensstufe.VOLL,
            } as PersonDto;

            const mockPersondatensatz1: PersonendatensatzDto = {
                person: person1,
                personenkontexte: [],
            };
            const mockPersondatensatz2: PersonendatensatzDto = {
                person: person2,
                personenkontexte: [],
            };
            const mockPersondatensatz: PagedResponse<PersonendatensatzDto> = new PagedResponse({
                offset: 0,
                limit: 10,
                total: 2,
                items: [mockPersondatensatz1, mockPersondatensatz2],
            });

            personUcMock.findAll.mockResolvedValue(mockPersondatensatz);

            const result: PagedResponse<PersonendatensatzResponse> = await personController.findPersons(queryParams);

            expect(personUcMock.findAll).toHaveBeenCalledTimes(1);
            expect(result.items.at(0)?.person.referrer).toEqual(queryParams.referrer);
            expect(result.items.at(0)?.person.name.vorname).toEqual(queryParams.vorname);
            expect(result.items.at(0)?.person.name.familienname).toEqual(queryParams.familienname);
            expect(result).toEqual(mockPersondatensatz);
        });
    });

    describe('createPersonenkontext', () => {
        describe('when creating a personenkontext', () => {
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

                await expect(personController.createPersonenkontext(pathParams, body)).resolves.not.toThrow();
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
                const personenkontextDtos: PersonenkontextDto[] = [personenkontextResponse];

                personenkontextUcMock.findAll.mockResolvedValue(personenkontextDtos);

                const result: PersonenkontextResponse[] = await personController.findPersonenkontexte(
                    pathParams,
                    queryParams,
                );

                expect(personenkontextUcMock.findAll).toHaveBeenCalledTimes(1);
                expect(result.length).toBe(1);
                expect(result[0]?.id).toBe(personenkontextDtos[0]?.id);
            });
        });
    });

    describe('when resetting password for a person', () => {
        const params: PersonByIdParams = {
            personId: faker.string.uuid(),
        };
        it('should reset password for person', async () => {
            const response: Result<string> = {
                ok: true,
                value: faker.string.alphanumeric({ length: { min: 10, max: 10 }, casing: 'mixed' }),
            };
            personUcMock.resetPassword.mockResolvedValueOnce(response);
            await expect(personController.resetPasswordByPersonId(params)).resolves.not.toThrow();
            expect(personUcMock.resetPassword).toHaveBeenCalledTimes(1);
        });
    });
});
