import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PersonenkontextWorkflowAggregate } from './personenkontext-workflow.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { DoFactory } from '../../../../test/utils/index.js';
import { Personenkontext } from './personenkontext.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { faker } from '@faker-js/faker';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextWorkflowFactory } from './personenkontext-workflow.factory.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { PersonenkontextFactory } from './personenkontext.factory.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DbiamPersonenkontextFactory } from './dbiam-personenkontext.factory.js';
import { DbiamPersonenkontextBodyParams } from '../api/param/dbiam-personenkontext.body.params.js';
import { PersonenkontexteUpdateError } from './error/personenkontexte-update.error.js';

function createPersonenkontext<WasPersisted extends boolean>(
    this: void,
    factory: PersonenkontextFactory,
    withId: WasPersisted,
    params: Partial<Personenkontext<boolean>> = {},
): Personenkontext<WasPersisted> {
    const personenkontext: Personenkontext<WasPersisted> = factory.construct<boolean>(
        withId ? faker.string.uuid() : undefined,
        withId ? faker.date.past() : undefined,
        withId ? faker.date.recent() : undefined,
        faker.string.uuid(),
        faker.string.uuid(),
        faker.string.uuid(),
    );

    Object.assign(personenkontext, params);

    return personenkontext;
}

function createRolleOrganisationsPersonKontext(
    factory: PersonenkontextFactory,
    anlage: PersonenkontextWorkflowAggregate,
): [Rolle<true>, OrganisationDo<true>, OrganisationDo<true>, OrganisationDo<true>, Personenkontext<true>] {
    const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
    const parentOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true, {
        typ: OrganisationsTyp.TRAEGER,
    });
    const childOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true, {
        typ: OrganisationsTyp.SCHULE,
    });
    const childsChildOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true, {
        typ: OrganisationsTyp.KLASSE,
    });
    childsChildOrganisation.administriertVon = childOrganisation.id;
    childOrganisation.administriertVon = parentOrganisation.id;
    anlage.selectedOrganisationId = childOrganisation.id;
    anlage.selectedRolleId = rolle.id;
    const personenkontext: Personenkontext<true> = createPersonenkontext(factory, true, {
        rolleId: rolle.id,
        organisationId: parentOrganisation.id,
    });
    return [rolle, parentOrganisation, childOrganisation, childsChildOrganisation, personenkontext];
}

describe('PersonenkontextWorkflow', () => {
    const LIMIT: number = 25;
    let module: TestingModule;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let organisationRepoMock: DeepMocked<OrganisationRepo>;
    let dBiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let anlage: PersonenkontextWorkflowAggregate;
    let personenkontextAnlageFactory: PersonenkontextWorkflowFactory;
    let personenkontextFactory: PersonenkontextFactory;
    let personpermissionsMock: DeepMocked<PersonPermissions>;
    let dbiamPersonenkontextFactoryMock: DeepMocked<DbiamPersonenkontextFactory>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonenkontextWorkflowFactory,
                PersonenkontextFactory,
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationRepo,
                    useValue: createMock<OrganisationRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonPermissions,
                    useValue: createMock<PersonPermissions>(),
                },
                {
                    provide: DbiamPersonenkontextFactory,
                    useValue: createMock<DbiamPersonenkontextFactory>(),
                },
            ],
        }).compile();
        rolleRepoMock = module.get(RolleRepo);
        organisationRepoMock = module.get(OrganisationRepo);
        dBiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        dbiamPersonenkontextFactoryMock = module.get(DbiamPersonenkontextFactory);
        personenkontextFactory = module.get(PersonenkontextFactory);
        personenkontextAnlageFactory = module.get(PersonenkontextWorkflowFactory);
        personenkontextFactory = module.get(PersonenkontextFactory);
        anlage = personenkontextAnlageFactory.createNew();
        personpermissionsMock = module.get(PersonPermissions);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(anlage).toBeDefined();
    });

    describe('initialize', () => {
        it('should initialize the aggregate with the selected Organisation and Rolle', () => {
            anlage.initialize('org-id', 'role-id');
            expect(anlage.selectedOrganisationId).toBe('org-id');
            expect(anlage.selectedRolleId).toBe('role-id');
        });
    });

    describe('findAllSchulstrukturknoten', () => {
        it('should return only the organisations that the admin has rights on', async () => {
            const organisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
            const organisations: OrganisationDo<true>[] = [organisation];
            organisationRepoMock.find.mockResolvedValue(organisations);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisation.id]);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                undefined,
                LIMIT,
            );
            expect(result).toEqual(organisations);
        });

        it('should return organisations based on name or kennung if provided', async () => {
            const organisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
            const organisations: OrganisationDo<true>[] = [organisation];
            organisationRepoMock.findByNameOrKennung.mockResolvedValue(organisations);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisation.id]);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                organisation.name,
                LIMIT,
            );
            expect(result).toEqual(organisations);
        });

        it('should return an empty array if no organisations are found', async () => {
            organisationRepoMock.find.mockResolvedValue([]);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([]);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                undefined,
                LIMIT,
            );
            expect(result).toEqual([]);
        });
        it('should sort organisations by name and kennung', async () => {
            const org1: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                kennung: 'K1',
                name: 'Beta School',
            });
            const org2: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                kennung: 'K2',
                name: 'Alpha School',
            });
            const org3: OrganisationDo<true> = DoFactory.createOrganisation(true, { name: 'Gamma School' });
            const org4: OrganisationDo<true> = DoFactory.createOrganisation(true, { kennung: 'K3' });
            const orgsWithRecht: string[] = [org1.id, org2.id, org3.id, org4.id];

            organisationRepoMock.find.mockResolvedValue([org1, org2, org3, org4]);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue(orgsWithRecht);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                undefined,
                10,
            );

            expect(result.length).toEqual(4);
        });

        it('should handle organisations with undefined kennung and name', async () => {
            const org1: OrganisationDo<true> = DoFactory.createOrganisation(true, { kennung: 'K1' });
            const org2: OrganisationDo<true> = DoFactory.createOrganisation(true, { name: 'Alpha School' });
            const org3: OrganisationDo<true> = DoFactory.createOrganisation(true, {});
            const orgsWithRecht: string[] = [org1.id, org2.id, org3.id];

            organisationRepoMock.find.mockResolvedValue([org1, org2, org3]);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue(orgsWithRecht);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                undefined,
                10,
            );

            expect(result.length).toEqual(3);
        });

        it('should return an empty array if no organisations are found', async () => {
            organisationRepoMock.find.mockResolvedValue([]);
            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValue([]);

            const result: OrganisationDo<true>[] = await anlage.findAllSchulstrukturknoten(
                personpermissionsMock,
                undefined,
                10,
            );

            expect(result).toEqual([]);
        });
    });
    describe('findRollenForOrganisation', () => {
        it('should return an empty array if no roles are found by name', async () => {
            rolleRepoMock.findByName.mockResolvedValue(undefined);

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(
                createMock<PersonPermissions>(),
                'rolle-name',
                10,
            );

            expect(result).toEqual([]);
        });

        it('should return an empty array if no organisations with system rights are found', async () => {
            rolleRepoMock.find.mockResolvedValue([createMock<Rolle<true>>()]);
            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.getOrgIdsWithSystemrecht.mockResolvedValue([]);

            anlage.initialize('organisation-id');

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(permissions);

            expect(result).toEqual([]);
        });

        it('should return an empty array if the organisation is not found', async () => {
            const rolle: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            rolleRepoMock.find.mockResolvedValue([createMock<Rolle<true>>()]);
            rolleRepoMock.find.mockResolvedValue([rolle]);

            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.getOrgIdsWithSystemrecht.mockResolvedValue(['org-id']);

            organisationRepoMock.findById.mockResolvedValue(undefined);

            anlage.initialize('org-id');

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(permissions);

            expect(result).toEqual([]);
        });

        it('should return an empty array if user does not have permission to view roles for the organisation', async () => {
            const rolle: DeepMocked<Rolle<true>> = createMock<Rolle<true>>();
            const organisation: DeepMocked<OrganisationDo<true>> = createMock<OrganisationDo<true>>();
            rolleRepoMock.find.mockResolvedValue([rolle]);
            organisationRepoMock.findById.mockResolvedValue(organisation);

            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.getOrgIdsWithSystemrecht.mockResolvedValue(['some-other-org-id']);

            anlage.initialize('organisation-id');

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(permissions);

            expect(result).toEqual([]);
        });
        it('should add roles to allowedRollen if user has permissions', async () => {
            const organisation: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.LAND,
            });
            const childOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.KLASSE,
            });
            const rolle: Rolle<true> = DoFactory.createRolle(true, {
                rollenart: RollenArt.ORGADMIN,
                name: 'Alpha' 
            });
            const rollen: Rolle<true>[] = [rolle];
            const orgsWithRecht: string[] = [organisation.id, childOrganisation.id];

            organisationRepoMock.findById.mockResolvedValue(organisation);
            organisationRepoMock.findChildOrgasForIds.mockResolvedValue([childOrganisation]);
            organisationRepoMock.findByIds.mockResolvedValue(
                new Map(orgsWithRecht.map((id: string) => [id, DoFactory.createOrganisation(true, { id })])),
            );
            rolleRepoMock.find.mockResolvedValue(rollen);

            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.getOrgIdsWithSystemrecht.mockResolvedValue(orgsWithRecht);

            anlage.initialize(organisation.id);

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(permissions);

            expect(result).toHaveLength(1);
        });
        it('should handle empty roles array', async () => {
            rolleRepoMock.find.mockResolvedValue([]);

            const organisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
            organisationRepoMock.findById.mockResolvedValue(organisation);

            const permissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            permissions.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisation.id]);

            anlage.initialize(organisation.id);

            const result: Rolle<true>[] = await anlage.findRollenForOrganisation(permissions);

            expect(result).toHaveLength(0);
        });
    });
    describe('commit', () => {
        it('should successfully commit personenkontexte', async () => {
            const personId: string = faker.string.uuid();
            const lastModified: Date = faker.date.recent();
            const count: number = 1;
            const personenkontexte: DbiamPersonenkontextBodyParams[] = [];

            const personenkontext: Personenkontext<true> = createMock<Personenkontext<true>>();
            const updateResult: Personenkontext<true>[] = [personenkontext];

            dbiamPersonenkontextFactoryMock.createNewPersonenkontexteUpdate.mockReturnValue({
                update: jest.fn().mockResolvedValue(updateResult),
            } as never);

            const result: Personenkontext<true>[] | PersonenkontexteUpdateError = await anlage.commit(
                personId,
                lastModified,
                count,
                personenkontexte,
            );

            expect(result).toEqual(updateResult);
        });

        it('should return an error if PersonenkontexteUpdateError is returned', async () => {
            const personId: string = faker.string.uuid();
            const lastModified: Date = faker.date.recent();
            const count: number = 1;
            const personenkontexte: DbiamPersonenkontextBodyParams[] = [];

            const updateError: PersonenkontexteUpdateError = new PersonenkontexteUpdateError('Error message');
            dbiamPersonenkontextFactoryMock.createNewPersonenkontexteUpdate.mockReturnValue({
                update: jest.fn().mockResolvedValue(updateError),
            } as never);

            const result: PersonenkontexteUpdateError | Personenkontext<true>[] = await anlage.commit(
                personId,
                lastModified,
                count,
                personenkontexte,
            );

            expect(result).toBeInstanceOf(PersonenkontexteUpdateError);
        });
    });

    it('should return an empty array if no personenkontexte are passed', async () => {
        const personId: string = faker.string.uuid();
        const lastModified: Date = faker.date.recent();
        const count: number = 0;
        const personenkontexte: DbiamPersonenkontextBodyParams[] = [];

        dbiamPersonenkontextFactoryMock.createNewPersonenkontexteUpdate.mockReturnValue({
            update: jest.fn().mockResolvedValue([]),
        } as never);

        const result: Personenkontext<true>[] | PersonenkontexteUpdateError = await anlage.commit(
            personId,
            lastModified,
            count,
            personenkontexte,
        );

        expect(result).toEqual([]);
    });

    describe('findSchulstrukturknoten', () => {
        it('should return list of schulstrukturknoten when parent-organisation is matching', async () => {
            const [rolle, parentOrganisation, , , personenkontext]: [
                Rolle<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                Personenkontext<true>,
            ] = createRolleOrganisationsPersonKontext(personenkontextFactory, anlage);
            const organisationen: OrganisationDo<true>[] = [parentOrganisation];
            const personenkontexte: Personenkontext<true>[] = [personenkontext];

            organisationRepoMock.findByNameOrKennung.mockResolvedValue(organisationen);
            dBiamPersonenkontextRepoMock.findByRolle.mockResolvedValue(personenkontexte);

            organisationRepoMock.findById.mockResolvedValue(parentOrganisation);

            organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([]);

            const counted2: Counted<OrganisationDo<true>> = [[], 1];
            organisationRepoMock.findBy.mockResolvedValueOnce(counted2); //mock call in findChildOrganisations, 2nd time (recursive)

            const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                rolle.id,
                parentOrganisation.name!,
                LIMIT,
            );
            expect(result).toHaveLength(1);
        });

        describe('matching of parent or child SSK', () => {
            it('should return list of schulstrukturknoten when child-organisation is matching', async () => {
                const [rolle, parent, child, subchild]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(personenkontextFactory, anlage);

                const foundByName: OrganisationDo<true>[] = [child];

                organisationRepoMock.findByNameOrKennung.mockResolvedValue(foundByName);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(parent); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([parent, child, subchild]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    child.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
            });

            it('should return list of schulstrukturknoten when child of child-organisation is matching with one results', async () => {
                const [rolle, parent, child, childOfChild]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(personenkontextFactory, anlage);

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([child, childOfChild]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(parent); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([parent, child, childOfChild]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    child.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
            });

            it('should return list of schulstrukturknoten when a valid child with name exist', async () => {
                const [rolle, parent, child]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(personenkontextFactory, anlage);

                const foundByName: OrganisationDo<true>[] = [child];
                const personenkontext: Personenkontext<true> = createPersonenkontext(personenkontextFactory, true, {
                    rolleId: rolle.id,
                    organisationId: parent.id,
                });
                const personenkontexte: Personenkontext<true>[] = [personenkontext];

                organisationRepoMock.findByNameOrKennung.mockResolvedValue(foundByName);
                dBiamPersonenkontextRepoMock.findByRolle.mockResolvedValue(personenkontexte);

                organisationRepoMock.findById.mockResolvedValue(undefined); //mock call to find parent in findSchulstrukturknoten

                const counted: Counted<OrganisationDo<true>> = [foundByName, 1];
                organisationRepoMock.findBy.mockResolvedValue(counted); //mock call in findChildOrganisations

                await expect(anlage.findSchulstrukturknoten(rolle.id, child.name!, LIMIT)).resolves.not.toThrow(Error);
            });
        });

        it('should return empty list when no rolle could be found', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            const organisationen: OrganisationDo<true>[] = [DoFactory.createOrganisation(true)];

            organisationRepoMock.findByNameOrKennung.mockResolvedValue(organisationen);
            rolleRepoMock.findById.mockResolvedValue(undefined);

            const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(rolle.id, 'nonexistent', LIMIT);

            expect(result).toHaveLength(0);
        });

        it('should return empty list when no parent organisation could be found', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            const organisationen: OrganisationDo<true>[] = [DoFactory.createOrganisation(true)];

            organisationRepoMock.findByNameOrKennung.mockResolvedValue(organisationen);
            rolleRepoMock.findById.mockResolvedValue(rolle);
            organisationRepoMock.findById.mockResolvedValue(undefined);

            const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(rolle.id, 'nonexistent', LIMIT);

            expect(result).toHaveLength(0);
        });

        it('should return empty list when no ssks could be found', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            const personenkontext: Personenkontext<true> = createPersonenkontext(personenkontextFactory, true);
            const personenkontexte: Personenkontext<true>[] = [personenkontext];
            organisationRepoMock.findByNameOrKennung.mockResolvedValue([]);
            dBiamPersonenkontextRepoMock.findByRolle.mockResolvedValue(personenkontexte);

            const counted: Counted<OrganisationDo<true>> = [[], 0];
            organisationRepoMock.findBy.mockResolvedValueOnce(counted); //mock call in findChildOrganisations, 2nd time (recursive)

            const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(rolle.id, 'nonexistent', LIMIT);
            expect(result).toHaveLength(0);
        });

        describe('filter organisations by RollenArt', () => {
            it('should return empty list, because orga as SCHULE does not match RollenArt SYSADMIN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.SCHULE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(0);
            });

            it('should return one element, because orga as LAND does match RollenArt SYSADMIN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.LAND,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return one element, because orga as ROOT does match RollenArt SYSADMIN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.ROOT,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return empty list, because orga as LAND does not match RollenArt LEIT', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.LAND,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(0);
            });

            it('should return one element, because orga as SCHULE does match RollenArt LEIT', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.SCHULE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return one element, because orga as SCHULE does match RollenArt LERN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.SCHULE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return one element, because orga as KLASSE does match RollenArt LERN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.KLASSE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return empty list, because orga as LAND does not match RollenArt LERN', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.LAND,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(0);
            });

            it('should return one element, because orga as SCHULE does match RollenArt LEHR', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.SCHULE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(1);
                expect(result).toContainEqual(organisationDo);
            });

            it('should return no element, because orga as KLASSE does not match RollenArt LEHR', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.KLASSE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(0);
            });

            it('should return empty list, because orga as LAND does not match RollenArt LEHR', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.LAND,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(0);
            });

            it('should not return klassen when excluded', async () => {
                const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                    typ: OrganisationsTyp.KLASSE,
                });

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([organisationDo]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(organisationDo); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([organisationDo]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    organisationDo.name!,
                    LIMIT,
                    true,
                );
                expect(result).toHaveLength(0);
            });
        });
    });

    describe('findAuthorizedRollen', () => {
        it('should return list of all rollen when they exist, if the user is Landesadmin', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                organisationRepoMock.ROOT_ORGANISATION_ID,
            ]);

            const result: Rolle<true>[] = await anlage.findAuthorizedRollen(personpermissionsMock);
            expect(result).toEqual(rollen);
        });

        it('should return list of all rollen when they exist Except Landesadmin, if the user is NOT Landesadmin', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            const organisationMap: Map<string, OrganisationDo<true>> = new Map();
            organisationMap.set(organisationDo.id, organisationDo);
            organisationRepoMock.findByIds.mockResolvedValueOnce(organisationMap);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisationDo.id]);

            const result: Rolle<true>[] = await anlage.findAuthorizedRollen(personpermissionsMock);
            expect(result).not.toContain(rolle);
        });

        it('should return list of rollen when they exist', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            rolleRepoMock.findByName.mockResolvedValue([rolle]);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                organisationRepoMock.ROOT_ORGANISATION_ID,
            ]);

            const result: Rolle<true>[] = await anlage.findAuthorizedRollen(personpermissionsMock, rolle.name, LIMIT);
            expect(result).toEqual([rolle]);
        });

        it('should return empty list when no rollen exist', async () => {
            rolleRepoMock.findByName.mockResolvedValue(undefined);

            const result: Rolle<true>[] = await anlage.findAuthorizedRollen(
                personpermissionsMock,
                'nonexistent',
                LIMIT,
            );
            expect(result).toEqual([]);
        });
    });
});
