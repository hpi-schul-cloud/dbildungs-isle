import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PersonenkontextAnlage } from './personenkontext-anlage.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { DoFactory } from '../../../../test/utils/index.js';
import { Personenkontext } from './personenkontext.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { faker } from '@faker-js/faker';
import { PersonenkontextAnlageError } from '../../../shared/error/personenkontext-anlage.error.js';
import { EntityNotFoundError } from '../../../shared/error/index.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { PersonenkontextAnlageFactory } from './personenkontext-anlage.factory.js';

function createPersonenkontext<WasPersisted extends boolean>(
    this: void,
    withId: WasPersisted,
    params: Partial<Personenkontext<boolean>> = {},
): Personenkontext<WasPersisted> {
    const personenkontext: Personenkontext<WasPersisted> = Personenkontext.construct<boolean>(
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
    anlage: PersonenkontextAnlage,
): [Rolle<true>, OrganisationDo<true>, OrganisationDo<true>, OrganisationDo<true>, Personenkontext<true>] {
    const rolle: Rolle<true> = DoFactory.createRolle(true);
    const parentOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
    const childOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
    const childsChildOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
    childsChildOrganisation.administriertVon = childOrganisation.id;
    childOrganisation.administriertVon = parentOrganisation.id;
    anlage.organisationId = childOrganisation.id;
    anlage.rolleId = rolle.id;
    const personenkontext: Personenkontext<true> = createPersonenkontext(true, {
        rolleId: rolle.id,
        organisationId: parentOrganisation.id,
    });
    return [rolle, parentOrganisation, childOrganisation, childsChildOrganisation, personenkontext];
}

describe('PersonenkontextAnlage', () => {
    const LIMIT: number = 25;
    let module: TestingModule;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let organisationRepoMock: DeepMocked<OrganisationRepo>;
    let dBiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let anlage: PersonenkontextAnlage;
    let personenkontextAnlageFactory: PersonenkontextAnlageFactory;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonenkontextAnlageFactory,
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationRepo,
                    useValue: createMock<OrganisationRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
        }).compile();
        rolleRepoMock = module.get(RolleRepo);
        organisationRepoMock = module.get(OrganisationRepo);
        dBiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        personenkontextAnlageFactory = module.get(PersonenkontextAnlageFactory);
        anlage = personenkontextAnlageFactory.createNew();
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

    describe('findSchulstrukturknoten', () => {
        it('should return list of schulstrukturknoten when parent-organisation is matching', async () => {
            const [rolle, parentOrganisation, , , personenkontext]: [
                Rolle<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                Personenkontext<true>,
            ] = createRolleOrganisationsPersonKontext(anlage);
            const organisationen: OrganisationDo<true>[] = [parentOrganisation];
            const personenkontexte: Personenkontext<true>[] = [personenkontext];

            organisationRepoMock.findByNameOrKennung.mockResolvedValue(organisationen);
            dBiamPersonenkontextRepoMock.findByRolle.mockResolvedValue(personenkontexte);

            organisationRepoMock.findById.mockResolvedValue(parentOrganisation);

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
                ] = createRolleOrganisationsPersonKontext(anlage);

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

            it('should return list of schulstrukturknoten when child of child-organisation is matching', async () => {
                const [rolle, parent, child, childOfChild]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);

                organisationRepoMock.findByNameOrKennung.mockResolvedValue([child, childOfChild]);
                rolleRepoMock.findById.mockResolvedValueOnce(rolle);
                organisationRepoMock.findById.mockResolvedValue(parent); //mock call to find parent in findSchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([parent, child, childOfChild]);

                const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
                    rolle.id,
                    child.name!,
                    LIMIT,
                );
                expect(result).toHaveLength(2);
            });

            it('should return list of schulstrukturknoten when a valid child with name exist', async () => {
                const [rolle, parent, child]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);

                const foundByName: OrganisationDo<true>[] = [child];
                const personenkontext: Personenkontext<true> = createPersonenkontext(true, {
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
            const personenkontext: Personenkontext<true> = createPersonenkontext(true);
            const personenkontexte: Personenkontext<true>[] = [personenkontext];
            organisationRepoMock.findByNameOrKennung.mockResolvedValue([]);
            dBiamPersonenkontextRepoMock.findByRolle.mockResolvedValue(personenkontexte);

            const counted: Counted<OrganisationDo<true>> = [[], 0];
            organisationRepoMock.findBy.mockResolvedValueOnce(counted); //mock call in findChildOrganisations, 2nd time (recursive)

            const result: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(rolle.id, 'nonexistent', LIMIT);
            expect(result).toHaveLength(0);
        });
    });

    describe('findRollen', () => {
        it('should return list of rollen when they exist', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            rolleRepoMock.findByName.mockResolvedValue([rolle]);

            const result: Rolle<true>[] = await anlage.findRollen(rolle.name, LIMIT);
            expect(result).toEqual([rolle]);
        });

        it('should return empty list when no rollen exist', async () => {
            rolleRepoMock.findByName.mockResolvedValue(undefined);

            const result: Rolle<true>[] = await anlage.findRollen('nonexistent', LIMIT);
            expect(result).toEqual([]);
        });
    });

    describe('validieren', () => {
        describe('when personenkontext is valid because rolle-SSK-Id is equal organisationId', () => {
            it('should return true', async () => {
                const [rolle, parent]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);

                rolleRepoMock.findById.mockResolvedValue(rolle);
                organisationRepoMock.findById.mockResolvedValue(parent); //find organisation from aggregate

                expect(await anlage.validieren()).toEqual({ ok: true, value: true });
            });
        });

        describe('when personenkontext is valid because rolle-SSK-Id is equal to a child of administering SSK', () => {
            it('should return true', async () => {
                const [rolle, parentOrganisation, childOrganisation]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);

                rolleRepoMock.findById.mockResolvedValue(rolle);
                organisationRepoMock.findById.mockResolvedValueOnce(childOrganisation); //find organisation from aggregate
                organisationRepoMock.findById.mockResolvedValueOnce(parentOrganisation); //find organisation from rolle.administeredBySchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([childOrganisation]); // find child organisations

                expect(await anlage.validieren()).toEqual({ ok: true, value: true });
            });
        });

        describe('when personenkontext is invalid because organisation is not a child of administering SSK', () => {
            it('should return true', async () => {
                const [rolle, parentOrganisation, childOrganisation]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);
                rolleRepoMock.findById.mockResolvedValue(rolle);
                organisationRepoMock.findById.mockResolvedValueOnce(childOrganisation); //find organisation from aggregate
                organisationRepoMock.findById.mockResolvedValueOnce(parentOrganisation); //find organisation from rolle.administeredBySchulstrukturknoten
                organisationRepoMock.findChildOrgasForIds.mockResolvedValueOnce([]); // find child organisations

                expect(await anlage.validieren()).toEqual({ ok: false, error: new EntityNotFoundError() });
            });
        });

        describe('when personenkontext is invalid by undefined rolleId', () => {
            it('should return error', async () => {
                anlage.rolleId = undefined;
                const error: Result<boolean, PersonenkontextAnlageError> = {
                    ok: false,
                    error: new PersonenkontextAnlageError('PersonenkontextAnlage invalid: rolleId is undefined'),
                };
                expect(await anlage.validieren()).toEqual(error);
            });
        });

        describe('when personenkontext is invalid by undefined organisationId', () => {
            it('should return error', async () => {
                anlage.rolleId = faker.string.uuid();
                anlage.organisationId = undefined;
                const error: Result<boolean, PersonenkontextAnlageError> = {
                    ok: false,
                    error: new PersonenkontextAnlageError('PersonenkontextAnlage invalid: organisationId is undefined'),
                };
                expect(await anlage.validieren()).toEqual(error);
            });
        });

        describe('when rolle cannot be found', () => {
            it('should return error', async () => {
                rolleRepoMock.findById.mockResolvedValue(undefined);
                createRolleOrganisationsPersonKontext(anlage);
                const error: Result<boolean, PersonenkontextAnlageError> = {
                    ok: false,
                    error: new PersonenkontextAnlageError('PersonenkontextAnlage invalid: rolle could not be found'),
                };
                expect(await anlage.validieren()).toEqual(error);
            });
        });

        describe('when organisation cannot be found', () => {
            it('should return error', async () => {
                const [rolle]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);
                rolleRepoMock.findById.mockResolvedValue(rolle);
                organisationRepoMock.findById.mockResolvedValue(undefined); //find organisation from aggregate returns undefined

                const error: Result<boolean, PersonenkontextAnlageError> = {
                    ok: false,
                    error: new PersonenkontextAnlageError(
                        'PersonenkontextAnlage invalid: organisation could not be found',
                    ),
                };
                expect(await anlage.validieren()).toEqual(error);
            });
        });

        describe('when organisation from rolle as administering SSK cannot be found', () => {
            it('should return error', async () => {
                const [rolle, parentOrganisation]: [
                    Rolle<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    OrganisationDo<true>,
                    Personenkontext<true>,
                ] = createRolleOrganisationsPersonKontext(anlage);
                rolleRepoMock.findById.mockResolvedValue(rolle);
                organisationRepoMock.findById.mockResolvedValueOnce(parentOrganisation); //find organisation from aggregate
                organisationRepoMock.findById.mockResolvedValueOnce(undefined); //find organisation from rolle.administeredBySchulstrukturknoten

                const error: Result<boolean, PersonenkontextAnlageError> = {
                    ok: false,
                    error: new PersonenkontextAnlageError(
                        'PersonenkontextAnlage invalid: organisation administering rolle could not be found',
                    ),
                };
                expect(await anlage.validieren()).toEqual(error);
            });
        });
    });

    describe('zuweisen', () => {
        it('should create and save a Personenkontext', async () => {
            const personId: string = faker.string.uuid();
            const [rolle, parentOrganisation]: [
                Rolle<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                OrganisationDo<true>,
                Personenkontext<true>,
            ] = createRolleOrganisationsPersonKontext(anlage);
            const personenkontext: Personenkontext<true> = createPersonenkontext(true, {
                personId: personId,
                rolleId: rolle.id,
                organisationId: parentOrganisation.id,
            });

            rolleRepoMock.findById.mockResolvedValue(rolle);
            organisationRepoMock.findById.mockResolvedValue(parentOrganisation); //find organisation from aggregate
            organisationRepoMock.findById.mockResolvedValue(parentOrganisation); //find organisation from rolle.administeredBySchulstrukturknoten
            dBiamPersonenkontextRepoMock.save.mockResolvedValue(personenkontext);

            const result: Result<Personenkontext<true>, PersonenkontextAnlageError> = await anlage.zuweisen(personId);
            expect(result).toEqual({
                ok: true,
                value: personenkontext,
            });
            expect(dBiamPersonenkontextRepoMock.save).toHaveBeenCalledTimes(1);
        });

        it('should return error when rolleId is undefined', async () => {
            const personId: string = faker.string.alpha();
            const personenkontext: Personenkontext<true> = createPersonenkontext(true);

            dBiamPersonenkontextRepoMock.save.mockResolvedValue(personenkontext);
            anlage.rolleId = undefined;
            const error: Result<boolean, PersonenkontextAnlageError> = {
                ok: false,
                error: new PersonenkontextAnlageError('PersonenkontextAnlage invalid: rolleId is undefined'),
            };
            expect(await anlage.zuweisen(personId)).toEqual(error);
        });

        it('should return error when organisationId is undefined', async () => {
            const personId: string = faker.string.alpha();
            const personenkontext: Personenkontext<true> = createPersonenkontext(true);

            dBiamPersonenkontextRepoMock.save.mockResolvedValue(personenkontext);
            anlage.rolleId = faker.string.uuid();
            anlage.organisationId = undefined;
            const error: Result<boolean, PersonenkontextAnlageError> = {
                ok: false,
                error: new PersonenkontextAnlageError('PersonenkontextAnlage invalid: organisationId is undefined'),
            };
            expect(await anlage.zuweisen(personId)).toEqual(error);
        });

        it('should return error when personkontext is invalid', async () => {
            const personId: string = faker.string.uuid();
            createRolleOrganisationsPersonKontext(anlage);
            rolleRepoMock.findById.mockResolvedValue(undefined);

            const result: Result<Personenkontext<true>, PersonenkontextAnlageError> = await anlage.zuweisen(personId);
            expect(result).toEqual(
                expect.objectContaining({
                    ok: false,
                }),
            );
            expect(dBiamPersonenkontextRepoMock.save).toHaveBeenCalledTimes(0);
        });
    });
});
