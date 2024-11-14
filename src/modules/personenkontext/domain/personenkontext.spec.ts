import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainError, EntityNotFoundError, MissingPermissionsError } from '../../../shared/error/index.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { RollenArt, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonenkontextFactory } from './personenkontext.factory.js';
import { Personenkontext } from './personenkontext.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { OrganisationMatchesRollenartError } from '../specification/error/organisation-matches-rollenart.error.js';

describe('Personenkontext aggregate', () => {
    let module: TestingModule;

    let personenkontextFactory: PersonenkontextFactory;
    let personRepoMock: DeepMocked<PersonRepository>;
    let organisationRepoMock: DeepMocked<OrganisationRepository>;
    let rolleRepoMock: DeepMocked<RolleRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonenkontextFactory,
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
            ],
        }).compile();

        personenkontextFactory = module.get(PersonenkontextFactory);
        personRepoMock = module.get(PersonRepository);
        organisationRepoMock = module.get(OrganisationRepository);
        rolleRepoMock = module.get(RolleRepo);
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('checkReferences', () => {
        it('should check if all references exist', async () => {
            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            await personenkontext.checkReferences();

            expect(personRepoMock.exists).toHaveBeenCalledWith(personenkontext.personId);
            expect(organisationRepoMock.findById).toHaveBeenCalledWith(personenkontext.organisationId);
            expect(rolleRepoMock.findById).toHaveBeenCalledWith(personenkontext.rolleId);
        });

        it('should return no error if all references are valid', async () => {
            personRepoMock.exists.mockResolvedValueOnce(true);
            const orgaMock: DeepMocked<Organisation<true>> = createMock<Organisation<true>>();
            organisationRepoMock.findById.mockResolvedValueOnce(orgaMock);
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeUndefined();
        });

        it('should return EntityNotFoundError if person does not exist', async () => {
            personRepoMock.exists.mockResolvedValueOnce(false);
            organisationRepoMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());
            rolleRepoMock.findById.mockResolvedValueOnce(createMock<Rolle<true>>());

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return EntityNotFoundError if organisation does not exist', async () => {
            personRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(undefined);
            rolleRepoMock.findById.mockResolvedValueOnce(createMock<Rolle<true>>());

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return EntityNotFoundError if rolle does not exist', async () => {
            personRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());
            rolleRepoMock.findById.mockResolvedValueOnce(undefined);

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return EntityNotFoundError if rolle can not be assigned to orga', async () => {
            personRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(createMock<Organisation<true>>());
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(false);

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeInstanceOf(EntityNotFoundError);
        });

        it('should return PersonenkontextAnlageError if rolle does not match orga', async () => {
            personRepoMock.exists.mockResolvedValueOnce(true);
            const orgaMock: DeepMocked<Organisation<true>> = createMock<Organisation<true>>();
            orgaMock.typ = OrganisationsTyp.SCHULE;
            organisationRepoMock.findById.mockResolvedValueOnce(orgaMock);
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.rollenart = RollenArt.SYSADMIN;
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true);

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<DomainError> = await personenkontext.checkReferences();

            expect(result).toBeInstanceOf(OrganisationMatchesRollenartError);
        });
    });

    describe('checkPermissions', () => {
        it('should return MissingPermissionsError, if logged in user is not authorized at organisation', async () => {
            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.hasSystemrechteAtOrganisation.mockResolvedValueOnce(false); // Check orga permissions

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            await expect(personenkontext.checkPermissions(permissions)).resolves.toEqual(
                new MissingPermissionsError('Unauthorized to manage persons at the organisation'),
            );

            expect(permissions.hasSystemrechteAtOrganisation).toHaveBeenCalledWith(personenkontext.organisationId, [
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);
        });

        it('should return MissingPermissionsError, if target person can not be modified by logged in user', async () => {
            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.hasSystemrechteAtOrganisation.mockResolvedValueOnce(true); // Check orga permissions
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true); // Check rolle<->orga validity
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            permissions.canModifyPerson.mockResolvedValueOnce(false); // Check person permissions

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            await expect(personenkontext.checkPermissions(permissions)).resolves.toEqual(
                new MissingPermissionsError('Not authorized to manage this person'),
            );
        });

        it('should not return an error, if kontext is valid', async () => {
            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.hasSystemrechteAtOrganisation.mockResolvedValueOnce(true); // Check orga permissions
            const rolleMock: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleMock.canBeAssignedToOrga.mockResolvedValueOnce(true); // Check rolle<->orga validity
            rolleRepoMock.findById.mockResolvedValueOnce(rolleMock);
            permissions.canModifyPerson.mockResolvedValueOnce(true); // Check person permissions

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            await expect(personenkontext.checkPermissions(permissions)).resolves.toBeUndefined();
        });
    });

    describe('getOrganisation', () => {
        it('should return the Organisation', async () => {
            const orgaMock: DeepMocked<Organisation<true>> = createMock<Organisation<true>>();
            organisationRepoMock.findById.mockResolvedValueOnce(orgaMock);

            const personenkontext: Personenkontext<false> = personenkontextFactory.createNew(
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.uuid(),
            );

            const result: Option<Organisation<true>> = await personenkontext.getOrganisation();

            expect(result).toBe(orgaMock);
        });
    });
});
