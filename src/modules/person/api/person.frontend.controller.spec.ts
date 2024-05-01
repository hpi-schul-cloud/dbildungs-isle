import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, MapperTestModule } from '../../../../test/utils/index.js';
import { SichtfreigabeType } from '../../personenkontext/domain/personenkontext.enums.js';
import { PersonApiMapperProfile } from './person-api.mapper.profile.js';
import { PersonFrontendController } from './person.frontend.controller.js';
import { PersonenQueryParams } from './personen-query.param.js';
import { Person } from '../domain/person.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { PagedResponse } from '../../../shared/paging/index.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';

describe('PersonFrontendController', () => {
    let module: TestingModule;
    let personController: PersonFrontendController;
    let personRepositoryMock: DeepMocked<PersonRepository>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule, ConfigTestModule],
            providers: [
                PersonFrontendController,
                PersonApiMapperProfile,
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
            ],
        }).compile();
        personController = module.get(PersonFrontendController);
        personRepositoryMock = module.get(PersonRepository);
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
            'Max',
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
            const personPermissions: DeepMocked<PersonPermissions> = createMock();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce([personController.ROOT_ORGANISATION_ID]);

            personRepositoryMock.findBy.mockResolvedValue([[person1, person2], 2]);

            const result: PagedResponse<PersonendatensatzResponse> = await personController.findPersons(
                queryParams,
                personPermissions,
            );
            expect(personRepositoryMock.findBy).toHaveBeenCalledTimes(1);
            expect(result.total).toEqual(2);
            expect(result.limit).toEqual(2);
            expect(result.offset).toEqual(0);
            expect(result.items.length).toEqual(2);
            expect(result.items.at(0)?.person.name.vorname).toEqual('Max');
        });
    });
});
