import { Dictionary, Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundError, PersonAlreadyExistsError } from '../../../shared/error/index.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { PersonRepo } from '../persistence/person.repo.js';
import { PersonDo } from './person.do.js';
import { PersonService } from './person.service.js';

describe('PersonService', () => {
    let module: TestingModule;
    let personService: PersonService;
    let personRepoMock: DeepMocked<PersonRepo>;
    let mapperMock: DeepMocked<Mapper>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonService,
                {
                    provide: PersonRepo,
                    useValue: createMock<PersonRepo>(),
                },
                {
                    provide: getMapperToken(),
                    useValue: createMock<Mapper>(),
                },
            ],
        }).compile();
        personService = module.get(PersonService);
        personRepoMock = module.get(PersonRepo);
        mapperMock = module.get(getMapperToken());
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(personService).toBeDefined();
    });

    describe('createPerson', () => {
        describe('when person does not exist', () => {
            it('should create person', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true);
                personRepoMock.findByReferrer.mockResolvedValue(null);
                personRepoMock.save.mockResolvedValue(person);
                mapperMock.map.mockReturnValue(person as unknown as Dictionary<unknown>);
                const result: Result<PersonDo<true>> = await personService.createPerson({
                    firstName: person.firstName,
                    lastName: person.lastName,
                    client: faker.string.uuid(),
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                });
                expect(result).toEqual<Result<PersonDo<true>>>({
                    ok: true,
                    value: person,
                });
            });
        });

        describe('when person already exists', () => {
            it('should return domain error', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true, { referrer: faker.string.uuid() });
                personRepoMock.findByReferrer.mockResolvedValue(person);
                const result: Result<PersonDo<true>> = await personService.createPerson({
                    firstName: person.firstName,
                    lastName: person.lastName,
                    client: person.client,
                    referrer: person.referrer as string,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                });
                expect(result).toEqual<Result<PersonDo<true>>>({
                    ok: false,
                    error: new PersonAlreadyExistsError(
                        `Person with referrer ${person.referrer as string} already exists`,
                    ),
                });
            });
        });
    });

    describe('findPersonById', () => {
        describe('when person exists', () => {
            it('should get a person', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true);
                personRepoMock.findById.mockResolvedValue(person);
                mapperMock.map.mockReturnValue(person as unknown as Dictionary<unknown>);
                const result: Result<PersonDo<true>> | Error = await personService.findPersonById(person.id);
                expect(result).toEqual<Result<PersonDo<true>>>({
                    ok: true,
                    value: person,
                });
            });
        });

        describe('when person cloud not be found', () => {
            it('should get a EntityNotFoundError error ', async () => {
                const person: PersonDo<true> = DoFactory.createPerson(true);
                personRepoMock.findById.mockResolvedValue(null);
                mapperMock.map.mockReturnValue(person as unknown as Dictionary<unknown>);
                const result: Result<PersonDo<true>> | Error = await personService.findPersonById(person.id);
                expect(result).toEqual<Result<PersonDo<true>>>({
                    ok: false,
                    error: new EntityNotFoundError(`Person with the following ID ${person.id} does not exist`),
                });
            });
        });
    });

    describe('findAllPersons', () => {
        describe('when person exists', () => {
            it('should get all persons that match', async () => {
                const firstPerson: PersonDo<false> = DoFactory.createPerson(false);
                const secondPerson: PersonDo<false> = DoFactory.createPerson(false);
                const persons: PersonDo<true>[] = [];
                persons.push(firstPerson as unknown as PersonDo<true>);
                persons.push(secondPerson as unknown as PersonDo<true>);
                personRepoMock.findAll.mockResolvedValue(persons);
                mapperMock.map.mockReturnValue(persons as unknown as Dictionary<unknown>);
                const personDoWithQueryParam: PersonDo<false>  = DoFactory.createPerson(false);
                const result: Option<PersonDo<true>>[] = await personService.findAllPersons(personDoWithQueryParam);
                expect(result).toHaveLength(2);
            });
        });

        describe('when no person were found', () => {
            it('should return an empty list of persons ', async () => {
                const person: PersonDo<false> = DoFactory.createPerson(false);
                personRepoMock.findAll.mockResolvedValue([]);
                mapperMock.map.mockReturnValue(person as unknown as Dictionary<unknown>);
                const result: Option<PersonDo<true>>[] = await personService.findAllPersons(person);
                expect(result).toBeInstanceOf(Array);
            });
        });
    });
});
