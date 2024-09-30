import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS } from '../../../../test/utils/index.js';
import { PersonPermissionsRepo } from './person-permission.repo.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Person } from '../../person/domain/person.js';
import { PermittedOrgas, PersonFields, PersonPermissions } from './person-permissions.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { RolleID } from '../../../shared/types/index.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { PersonenkontextRolleFieldsResponse } from '../api/personen-kontext-rolle-fields.response.js';
import { RollenSystemRechtServiceProviderIDResponse } from '../api/rolle-systemrechte-serviceproviderid.response.js';
import { PersonenkontextFactory } from '../../personenkontext/domain/personenkontext.factory.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';

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
    let organisationRepoMock: DeepMocked<OrganisationRepository>;
    let rolleRepoMock: DeepMocked<RolleRepo>;

    let personenkontextFactory: PersonenkontextFactory;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                PersonPermissionsRepo,
                PersonenkontextFactory,
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                PersonenkontextFactory,
            ],
        }).compile();

        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        organisationRepoMock = module.get(OrganisationRepository);
        rolleRepoMock = module.get(RolleRepo);
        personenkontextFactory = module.get(PersonenkontextFactory);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    function createPersonenkontext(): Personenkontext<true> {
        return personenkontextFactory.construct(
            '1',
            faker.date.past(),
            faker.date.recent(),
            '1',
            '1',
            '1',
            '1',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        );
    }

    describe('getRoleIds', () => {
        describe('when person can be found', () => {
            it('should load PersonPermissions', async () => {
                const person: Person<true> = createPerson();
                const personenkontexte: Personenkontext<true>[] = [createPersonenkontext()];
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                const personPermissions: PersonPermissions = new PersonPermissions(
                    dbiamPersonenkontextRepoMock,
                    organisationRepoMock,
                    rolleRepoMock,
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
                const personenkontexte: Personenkontext<true>[] = [createPersonenkontext()];
                dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
                const personPermissions: PersonPermissions = new PersonPermissions(
                    dbiamPersonenkontextRepoMock,
                    organisationRepoMock,
                    rolleRepoMock,
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

    describe('getOrgIdsWithSystemrecht', () => {
        it('should return { all: true } if person has rights at root', async () => {
            const person: Person<true> = Person.construct(
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
            dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation.mockResolvedValue(true);

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            const permittedOrgas: PermittedOrgas = await personPermissions.getOrgIdsWithSystemrecht(
                [RollenSystemRecht.PERSONEN_VERWALTEN],
                true,
            );

            expect(permittedOrgas.all).toBe(true);
        });
        it('should return orgas with children', async () => {
            const person: Person<true> = Person.construct(
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
            const personenkontexte: Personenkontext<true>[] = [createPersonenkontext()];
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation.mockResolvedValue(false);
            rolleRepoMock.findByIds.mockResolvedValueOnce(
                new Map([['1', createMock<Rolle<true>>({ hasSystemRecht: () => true })]]),
            );
            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([
                createMock<Organisation<true>>({ id: '2' }),
            ]);

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            const permittedOrgas: PermittedOrgas = await personPermissions.getOrgIdsWithSystemrecht(
                [RollenSystemRecht.PERSONEN_VERWALTEN],
                true,
            );

            if (permittedOrgas.all) {
                fail('permittedOrgas.all should be false');
            }
            expect(permittedOrgas.orgaIds).toContain('1');
            expect(permittedOrgas.orgaIds).toContain('2');
        });

        it('should return organisations without children', async () => {
            const person: Person<true> = Person.construct(
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
            const personenkontexte: Personenkontext<true>[] = [createPersonenkontext()];
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(
                new Map<string, Rolle<true>>([['1', createMock<Rolle<true>>({ hasSystemRecht: () => true })]]),
            );

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );

            const permittedOrgas: PermittedOrgas = await personPermissions.getOrgIdsWithSystemrecht([
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);
            if (permittedOrgas.all) {
                fail('permittedOrgas.all should be false');
            }
            expect(permittedOrgas.orgaIds).toContain('1');
            expect(permittedOrgas.orgaIds).not.toContain('2');
        });
    });

    describe('getPersonenkontextewithRoles', () => {
        it('should return person context with system rights and service provider ids in an object roles', async () => {
            const person: Person<true> = createPerson();
            const personenkontexte: Personenkontext<true>[] = [createPersonenkontext()];
            const expectedRolle: Rolle<true> = createMock<Rolle<true>>({ hasSystemRecht: () => true });
            dbiamPersonenkontextRepoMock.findByPerson.mockResolvedValueOnce(personenkontexte);
            rolleRepoMock.findByIds.mockResolvedValueOnce(new Map([['1', expectedRolle]]));

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            const result: PersonenkontextRolleFieldsResponse[] = await personPermissions.getPersonenkontextewithRoles();

            const expected: PersonenkontextRolleFieldsResponse[] = personenkontexte.map(
                (pk: Personenkontext<true>) => ({
                    organisationsId: pk.organisationId,
                    rolle: {
                        systemrechte: expectedRolle.systemrechte,
                        serviceProviderIds: expectedRolle.serviceProviderIds,
                    },
                }),
            );

            expect(result).toEqual(expected);
        });
    });

    describe('PersonenkontextRolleFieldsResponse', () => {
        it('should create a valid PersonenkontextRolleFieldsResponse object', () => {
            const rollenSystemRechtServiceProviderID: RollenSystemRechtServiceProviderIDResponse =
                new RollenSystemRechtServiceProviderIDResponse(['right1', 'right2'], ['service1', 'service2']);
            const response: PersonenkontextRolleFieldsResponse = new PersonenkontextRolleFieldsResponse(
                'testOrgId',
                rollenSystemRechtServiceProviderID,
            );

            expect(response.organisationsId).toEqual('testOrgId');
            expect(response.rolle.systemrechte).toEqual(['right1', 'right2']);
            expect(response.rolle.serviceProviderIds).toEqual(['service1', 'service2']);
        });
    });

    describe('hasSystemrechteAtOrganisation', () => {
        it('should return true if person has the recht', async () => {
            const person: Person<true> = Person.construct(
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
            dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation.mockResolvedValueOnce(true);

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            const result: boolean = await personPermissions.hasSystemrechteAtOrganisation('2', [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);

            expect(result).toBeTruthy();
            expect(dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation).toHaveBeenCalledTimes(1);
        });
    });

    describe('hasSystemrechteAtRootOrganisation', () => {
        it('should return true if person has the recht', async () => {
            const person: Person<true> = Person.construct(
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
            dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation.mockResolvedValue(true);

            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            const result: boolean = await personPermissions.hasSystemrechteAtRootOrganisation([
                RollenSystemRecht.PERSONEN_VERWALTEN,
                RollenSystemRecht.KLASSEN_VERWALTEN,
            ]);

            expect(result).toBeTruthy();
            expect(dbiamPersonenkontextRepoMock.hasSystemrechtAtOrganisation).toHaveBeenCalledTimes(2);
        });
    });

    describe('canModifyPerson', () => {
        it('should return true, if person has permission at root', async () => {
            const person: Person<true> = Person.construct(
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
            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            jest.spyOn(personPermissions, 'hasSystemrechteAtRootOrganisation').mockResolvedValueOnce(true);

            const result: boolean = await personPermissions.canModifyPerson('2');

            expect(result).toBe(true);
        });

        it('should return false, if person is missing permissions on target person', async () => {
            const person: Person<true> = Person.construct(
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
            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            jest.spyOn(personPermissions, 'hasSystemrechteAtRootOrganisation').mockResolvedValueOnce(false);
            dbiamPersonenkontextRepoMock.hasPersonASystemrechtAtAnyKontextOfPersonB.mockResolvedValueOnce(false);

            const result: boolean = await personPermissions.canModifyPerson('2');

            expect(result).toBe(false);
        });

        it('should return true, if person has permissions on target person', async () => {
            const person: Person<true> = Person.construct(
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
            const personPermissions: PersonPermissions = new PersonPermissions(
                dbiamPersonenkontextRepoMock,
                organisationRepoMock,
                rolleRepoMock,
                person,
            );
            jest.spyOn(personPermissions, 'hasSystemrechteAtRootOrganisation').mockResolvedValueOnce(false);
            dbiamPersonenkontextRepoMock.hasPersonASystemrechtAtAnyKontextOfPersonB.mockResolvedValueOnce(true);

            const result: boolean = await personPermissions.canModifyPerson('2');

            expect(result).toBe(true);
        });
    });
});
