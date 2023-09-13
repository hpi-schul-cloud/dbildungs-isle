import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { MapperTestModule } from '../../../../test/utils/index.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { PersonApiMapperProfile } from './person-api.mapper.profile.js';
import { PersonController } from './person.controller.js';
import { PersonUc } from './person.uc.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { PersonResponse } from './person.response.js';
import { HttpException } from '@nestjs/common';
import { PersonenQueryParam } from './personen-query.param.js';
import { PersonBirthParams } from './person-birth.params.js';
import { TrustLevel } from '../domain/person.enums.js';
import { PersonenDatensatz } from './personendatensatz.js';

describe('PersonController', () => {
    let module: TestingModule;
    let personController: PersonController;
    let personUcMock: DeepMocked<PersonUc>;
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
            ],
        }).compile();
        personController = module.get(PersonController);
        personUcMock = module.get(PersonUc);
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
            const personResponse: PersonResponse = {
                id: faker.string.uuid(),
                name: {
                    vorname: faker.person.firstName(),
                    familienname: faker.person.lastName(),
                    initialenfamilienname: faker.person.lastName(),
                    initialenvorname: faker.person.firstName(),
                    rufname: faker.person.middleName(),
                    title: faker.string.alpha(),
                    anrede: [faker.string.alpha(), faker.string.alpha()],
                    namenssuffix: [],
                    namenspraefix: [],
                    sortierindex: 'sortierindex',
                },
                mandant: faker.string.uuid(),
                referrer: faker.string.uuid(),
                geburt: {
                    datum: new Date('2022.02.02'),
                    geburtsort: faker.location.country(),
                },
                geschlecht: faker.person.gender(),
                lokalisierung: faker.location.country(),
                vertrauensstufe: TrustLevel.TRUSTED,
            };
            const persondatensatz: PersonenDatensatz = {
                person: personResponse,
            };
            personUcMock.findPersonById.mockResolvedValue(persondatensatz);
            await expect(personController.findPersonById(params)).resolves.not.toThrow();
            expect(personUcMock.findPersonById).toHaveBeenCalledTimes(1);
        });

        it('should throw an Http not found exception', async () => {
            const mockError: Error = new Error('person does not exist.');
            personUcMock.findPersonById.mockRejectedValue(mockError);
            await expect(personController.findPersonById(params)).resolves.toThrow(HttpException);
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
        const queryParams: PersonenQueryParam = {
            referrer: options.referrer,
            familienname: options.lastName,
            vorname: options.firstName,
        };

        it('should get all persons', async () => {
            const person1: PersonResponse = {
                id: faker.string.uuid(),
                name: {
                    familienname: options.lastName,
                    vorname: options.firstName,
                },
                mandant: '',
                referrer: options.referrer,
                geburt: mockBirthParams,
                geschlecht: '',
                lokalisierung: '',
                vertrauensstufe: TrustLevel.TRUSTED,
            };

            const person2: PersonResponse = {
                id: faker.string.uuid(),
                name: {
                    familienname: options.lastName,
                    vorname: options.firstName,
                },
                mandant: '',
                referrer: options.referrer,
                geburt: mockBirthParams,
                geschlecht: '',
                lokalisierung: '',
                vertrauensstufe: TrustLevel.TRUSTED,
            };

            const mockPersondatensatz1: PersonenDatensatz = {
                person: person1,
            };
            const mockPersondatensatz2: PersonenDatensatz = {
                person: person2,
            };
            const mockPersondatensatz: PersonenDatensatz[] = [mockPersondatensatz1, mockPersondatensatz2];
            personUcMock.findAll.mockResolvedValue(mockPersondatensatz);
            const result: PersonenDatensatz[] = await personController.findPersons(queryParams);
            expect(personUcMock.findAll).toHaveBeenCalledTimes(1);
            expect(result.at(0)?.person.referrer).toEqual(queryParams.referrer);
            expect(result.at(0)?.person.name.vorname).toEqual(queryParams.vorname);
            expect(result.at(0)?.person.name.familienname).toEqual(queryParams.familienname);
            expect(result).toEqual(mockPersondatensatz);
        });
    });
});
