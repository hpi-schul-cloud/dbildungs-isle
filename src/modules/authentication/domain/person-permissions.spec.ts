import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS } from '../../../../test/utils/index.js';
import { PersonPermissionsRepo } from './person-permission.repo.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Person } from '../../person/domain/person.js';
import { PersonFields, PersonPermissions } from './person-permissions.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { RolleID } from '../../../shared/types/index.js';

function createPerson(): Person<true> {
    return Person.construct(
        faker.string.uuid(),
        faker.date.past(),
        faker.date.recent(),
        faker.person.lastName(),
        faker.person.firstName(),
        '1',
        faker.lorem.word(),
        undefined,
        faker.string.uuid(),
    );
}

describe('PersonPermissions', () => {
    let module: TestingModule;
    let dbiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                PersonPermissionsRepo,
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
            ],
        }).compile();

        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeEach(async () => {});

    describe('getRoleIds', () => {
        describe('when person can be found', () => {
            it('should load PersonPermissions', async () => {
                const person: Person<true> = createPerson();
                const personenkontexte: Personenkontext<true>[] = [
                    Personenkontext.construct('1', faker.date.past(), faker.date.recent(), '1', '1', '1'),
                ];
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                const personPermissions: PersonPermissions = new PersonPermissions(
                    dbiamPersonenkontextRepoMock,
                    person,
                );
                const ids: RolleID[] = await personPermissions.getRoleIds();
                expect(ids).toContain('1');
            });
        });
    });

    describe('personFields', () => {
        describe('when person can be found', () => {
            it('should return cached person fields', () => {
                const person: Person<true> = createPerson();
                const personenkontexte: Personenkontext<true>[] = [
                    Personenkontext.construct('1', faker.date.past(), faker.date.recent(), '1', '1', '1'),
                ];
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                const personPermissions: PersonPermissions = new PersonPermissions(
                    dbiamPersonenkontextRepoMock,
                    person,
                );
                const personFields: PersonFields = personPermissions.personFields;
                expect(personFields.id).toEqual(person.id);
                expect(personFields.familienname).toEqual(person.familienname);
                expect(personFields.vorname).toEqual(person.vorname);
                expect(personFields.keycloakUserId).toEqual(person.keycloakUserId);
                expect(personFields.username).toEqual(person.username);
            });
        });
    });
});
