import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { EntityCouldNotBeCreated } from '../../../shared/error/entity-could-not-be-created.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { Paged } from '../../../shared/paging/paged.js';
import { PersonDo } from '../../person/domain/person.do.js';
import { PersonService } from '../../person/domain/person.service.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { Personenstatus, Rolle, SichtfreigabeType } from '../domain/personenkontext.enums.js';
import { PersonenkontextService } from '../domain/personenkontext.service.js';
import { CreatePersonenkontextDto } from './create-personenkontext.dto.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { PersonApiMapperProfile } from '../../person/api/person-api.mapper.profile.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { PersonenkontextUc } from './personenkontext.uc.js';
import { PersonendatensatzDto } from '../../person/api/personendatensatz.dto.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { DeletePersonenkontextDto } from './delete-personkontext.dto.js';

describe('PersonenkontextUc', () => {
    let module: TestingModule;
    let sut: PersonenkontextUc;
    let personServiceMock: DeepMocked<PersonService>;
    let personenkontextServiceMock: DeepMocked<PersonenkontextService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                PersonenkontextUc,
                PersonApiMapperProfile,
                {
                    provide: PersonService,
                    useValue: createMock<PersonService>(),
                },
                {
                    provide: PersonenkontextService,
                    useValue: createMock<PersonenkontextService>(),
                },
            ],
        }).compile();
        sut = module.get(PersonenkontextUc);
        personServiceMock = module.get(PersonService);
        personenkontextServiceMock = module.get(PersonenkontextService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('createPersonenkontext', () => {
        describe('when creation of personenkontext is successful', () => {
            it('should return CreatedPersonenkontextDto', async () => {
                const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                personenkontextServiceMock.createPersonenkontext.mockResolvedValue({
                    ok: true,
                    value: personenkontextDo,
                });

                const result: CreatedPersonenkontextDto | SchulConnexError = await sut.createPersonenkontext(
                    {} as CreatePersonenkontextDto,
                );

                expect(result).toBeInstanceOf(CreatedPersonenkontextDto);
            });
        });

        describe('when creation of personenkontext is not successful', () => {
            it('should return SchulConnexError', async () => {
                const error: EntityCouldNotBeCreated = new EntityCouldNotBeCreated('Personenkontext');
                personenkontextServiceMock.createPersonenkontext.mockResolvedValue({
                    ok: false,
                    error: error,
                });

                const result: CreatedPersonenkontextDto | SchulConnexError = await sut.createPersonenkontext(
                    {} as CreatePersonenkontextDto,
                );

                expect(result).toBeInstanceOf(SchulConnexError);
            });
        });
    });

    describe('findAll', () => {
        describe('When searching for personenkontexte', () => {
            it('should find all persons that match with query param', async () => {
                const findPersonenkontextDto: FindPersonenkontextDto = {
                    personId: faker.string.uuid(),
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.NEIN,
                    personenstatus: Personenstatus.AKTIV,
                    rolle: Rolle.LERNENDER,
                };

                const firstPersonenkontext: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                const secondPersonenkontext: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                const personenkontexte: PersonenkontextDo<true>[] = [firstPersonenkontext, secondPersonenkontext];
                personenkontextServiceMock.findAllPersonenkontexte.mockResolvedValue({
                    items: personenkontexte,
                    total: personenkontexte.length,
                    limit: personenkontexte.length,
                    offset: 0,
                });

                const result: Paged<PersonenkontextDto> = await sut.findAll(findPersonenkontextDto);
                expect(result.items).toHaveLength(2);
            });

            it('should return empty array when no matching persons are found', async () => {
                const findPersonenkontextDto: FindPersonenkontextDto = {
                    personId: faker.string.uuid(),
                    referrer: 'referrer',
                    sichtfreigabe: SichtfreigabeType.NEIN,
                    personenstatus: Personenstatus.AKTIV,
                    rolle: Rolle.LERNENDER,
                };

                const emptyResult: Paged<PersonenkontextDo<true>> = {
                    items: [],
                    total: 0,
                    limit: 0,
                    offset: 0,
                };
                personenkontextServiceMock.findAllPersonenkontexte.mockResolvedValue(emptyResult);

                const result: Paged<PersonenkontextDto> = await sut.findAll(findPersonenkontextDto);

                expect(result.items).toHaveLength(0);
            });
        });
    });

    describe('findPersonenkontextById', () => {
        describe('when finding personenkontext with id', () => {
            it('should return personenkontext', async () => {
                const personDo: PersonDo<true> = DoFactory.createPerson(true);
                const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                const dto: FindPersonenkontextByIdDto = {
                    personenkontextId: personenkontextDo.id,
                };

                personServiceMock.findPersonById.mockResolvedValue({ ok: true, value: personDo });
                personenkontextServiceMock.findPersonenkontextById.mockResolvedValue({
                    ok: true,
                    value: personenkontextDo,
                });

                await expect(sut.findPersonenkontextById(dto)).resolves.not.toThrow();
            });
        });

        describe('when NOT finding personenkontext with id', () => {
            it('should return SchulConnexError with code 404 for personenkontext not found', async () => {
                const dto: FindPersonenkontextByIdDto = {
                    personenkontextId: faker.string.uuid(),
                };

                personenkontextServiceMock.findPersonenkontextById.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError('Personenkontext'),
                });

                const result: PersonendatensatzDto | SchulConnexError = await sut.findPersonenkontextById(dto);

                if (result instanceof PersonendatensatzDto) {
                    fail('Expected SchulConnexError');
                }
                expect(result.code).toBe(404);
            });

            // AI next 13 lines
            it('should return SchulConnexError with code 404 for person not found', async () => {
                const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                const dto: FindPersonenkontextByIdDto = {
                    personenkontextId: personenkontextDo.id,
                };

                personenkontextServiceMock.findPersonenkontextById.mockResolvedValue({
                    ok: true,
                    value: personenkontextDo,
                });
                personServiceMock.findPersonById.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError('Person'),
                });

                const result: PersonendatensatzDto | SchulConnexError = await sut.findPersonenkontextById(dto);

                if (result instanceof PersonendatensatzDto) {
                    fail('Expected SchulConnexError');
                }
                expect(result.code).toBe(404);
            });
        });
    });

    describe('updatePersonenkontext', () => {
        // AI next 34 lines
        describe('when updating personenkontext is successful', () => {
            it('should return a PersonendatensatzDto', async () => {
                const personDo: PersonDo<true> = DoFactory.createPerson(true);
                const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);

                personServiceMock.findPersonById.mockResolvedValue({ ok: true, value: personDo });
                personenkontextServiceMock.updatePersonenkontext.mockResolvedValue({
                    ok: true,
                    value: personenkontextDo,
                });

                const updatePersonPromise: Promise<PersonendatensatzDto | SchulConnexError> = sut.updatePersonenkontext(
                    {} as PersonenkontextDto,
                );

                await expect(updatePersonPromise).resolves.toBeInstanceOf(PersonendatensatzDto);
            });
        });

        describe('when updating personenkontext is not successful', () => {
            it('should return SchulConnexError', async () => {
                const error: EntityCouldNotBeCreated = new EntityCouldNotBeCreated('Personenkontext');
                personenkontextServiceMock.updatePersonenkontext.mockResolvedValue({
                    ok: false,
                    error: error,
                });

                const updatePersonPromise: Promise<PersonendatensatzDto | SchulConnexError> = sut.updatePersonenkontext(
                    {} as PersonenkontextDto,
                );

                await expect(updatePersonPromise).resolves.toBeInstanceOf(SchulConnexError);
            });
        });

        describe('when person for personenkontext could not be found', () => {
            it('should return SchulConnexError', async () => {
                // AI next 13 lines
                const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
                const error: EntityNotFoundError = new EntityNotFoundError('Person');

                personenkontextServiceMock.updatePersonenkontext.mockResolvedValue({
                    ok: true,
                    value: personenkontextDo,
                });
                personServiceMock.findPersonById.mockResolvedValue({ ok: false, error: error });

                const updatePersonPromise: Promise<PersonendatensatzDto | SchulConnexError> = sut.updatePersonenkontext(
                    {} as PersonenkontextDto,
                );

                await expect(updatePersonPromise).resolves.toBeInstanceOf(SchulConnexError);
            });
        });
    });

    describe('deletePersonenkontextById', () => {
        const deletePersonenkontextDto: DeletePersonenkontextDto = {
            id: faker.string.uuid(),
            revision: '1',
        };

        describe('when deleting personenkontext is successful', () => {
            it('should return nothing', async () => {
                personenkontextServiceMock.deletePersonenkontextById.mockResolvedValue({
                    ok: true,
                    value: undefined,
                });

                const result: void | SchulConnexError = await sut.deletePersonenkontextById(deletePersonenkontextDto);

                expect(result).toBeUndefined();
            });
        });

        describe('when personenkontext that should be deleted was not found', () => {
            it('should return SchulConnexError', async () => {
                personenkontextServiceMock.deletePersonenkontextById.mockResolvedValue({
                    ok: false,
                    error: new EntityNotFoundError('Personenkontext'),
                });

                const result: void | SchulConnexError = await sut.deletePersonenkontextById(deletePersonenkontextDto);

                expect(result).toBeInstanceOf(SchulConnexError);
                expect(result?.code).toBe(404);
            });
        });
    });
});
