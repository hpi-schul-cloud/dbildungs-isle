import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Dictionary } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { EntityCouldNotBeCreated } from '../../../shared/error/entity-could-not-be-created.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { EntityCouldNotBeUpdated } from '../../../shared/error/index.js';
import { Paged } from '../../../shared/paging/index.js';
import { OrganisationService } from './organisation.service.js';
import { OrganisationsTyp } from './organisation.enums.js';
import { KennungRequiredForSchuleError } from '../specification/error/kennung-required-for-schule.error.js';
import { NameRequiredForSchuleError } from '../specification/error/name-required-for-schule.error.js';
import { SchuleKennungEindeutigError } from '../specification/error/schule-kennung-eindeutig.error.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { Organisation } from './organisation.js';
import { NameForOrganisationWithTrailingSpaceError } from '../specification/error/name-with-trailing-space.error.js';
import { KennungForOrganisationWithTrailingSpaceError } from '../specification/error/kennung-with-trailing-space.error.js';

describe('OrganisationService', () => {
    let module: TestingModule;
    let organisationService: OrganisationService;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;
    let mapperMock: DeepMocked<Mapper>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                OrganisationService,
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: getMapperToken(),
                    useValue: createMock<Mapper>(),
                },
            ],
        }).compile();
        organisationService = module.get(OrganisationService);
        organisationRepositoryMock = module.get(OrganisationRepository);
        mapperMock = module.get(getMapperToken());
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(organisationService).toBeDefined();
    });

    describe('createOrganisation', () => {
        it('should create an organisation', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false);
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            mapperMock.map.mockReturnValue(organisation as unknown as Dictionary<unknown>);
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: true,
                value: organisation as unknown as Organisation<true>,
            });
        });

        it('should return a domain error if first parent organisation does not exist', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false);
            organisation.administriertVon = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(false);

            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisation.administriertVon),
            });
        });

        it('should return a domain error if second parent organisation does not exist', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false);
            organisation.zugehoerigZu = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(false);

            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisation.zugehoerigZu),
            });
        });

        it('should return a domain error if kennung is not set and type is schule', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SCHULE,
                kennung: undefined,
            });
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            mapperMock.map.mockReturnValue(organisation as unknown as Dictionary<unknown>);

            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungRequiredForSchuleError(),
            });
        });

        it('should return a domain error if name is not set and type is schule', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SCHULE,
                kennung: '1234567',
                name: undefined,
            });
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            mapperMock.map.mockReturnValue(organisation as unknown as Dictionary<unknown>);

            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameRequiredForSchuleError(),
            });
        });

        it('should return a domain error if kennung is not unique and type is schule', async () => {
            const name: string = faker.string.alpha();
            const kennung: string = faker.string.numeric({ length: 7 });
            const organisation: Organisation<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SCHULE,
                kennung: kennung,
                name: name,
            });
            const counted: Counted<Organisation<true>> = [
                [
                    DoFactory.createOrganisation(true, {
                        typ: OrganisationsTyp.SCHULE,
                        kennung: kennung,
                        name: name,
                    }),
                ],
                1,
            ];
            organisationRepositoryMock.findBy.mockResolvedValueOnce(counted);
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            mapperMock.map.mockReturnValue(organisation as unknown as Dictionary<unknown>);

            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new SchuleKennungEindeutigError(),
            });
        });

        it('should return a domain error', async () => {
            const organisation: Organisation<false> = DoFactory.createOrganisation(false);
            organisation.id = faker.string.uuid();
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisation);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityCouldNotBeCreated(`Organization could not be created`),
            });
        });

        it('should return domain error if name contains trailing space', async () => {
            const organisationDo: Organisation<false> = DoFactory.createOrganisation(false, { name: ' name' });
            organisationRepositoryMock.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if kennung contains trailing space', async () => {
            const organisationDo: Organisation<false> = DoFactory.createOrganisation(false, { kennung: ' ' });
            organisationRepositoryMock.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if name contains trailing space', async () => {
            const organisationDo: Organisation<false> = DoFactory.createOrganisation(false, { name: ' name' });
            organisationRepositoryMock.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if kennung contains trailing space', async () => {
            const organisationDo: Organisation<false> = DoFactory.createOrganisation(false, { kennung: ' ' });
            organisationRepositoryMock.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            const result: Result<Organisation<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungForOrganisationWithTrailingSpaceError(),
            });
        });
    });

    describe('updateOrganisation', () => {
        it('should update an organisation', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true);
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: true,
                value: organisation as unknown as Organisation<true>,
            });
        });

        it('should return a domain error', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true);
            organisation.id = '';
            organisationRepositoryMock.findById.mockResolvedValue({} as Option<Organisation<true>>);
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityCouldNotBeUpdated(`Organization could not be updated`, organisation.id),
            });
        });

        it('should return a domain error if kennung is not set and type is schule', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                kennung: undefined,
            });
            organisationRepositoryMock.findById.mockResolvedValue(organisation as unknown as Organisation<true>);

            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungRequiredForSchuleError(),
            });
        });

        it('should return a domain error if name is not set and type is schule', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                kennung: '1234567',
                name: undefined,
            });
            organisationRepositoryMock.findById.mockResolvedValue(organisation as unknown as Organisation<true>);

            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameRequiredForSchuleError(),
            });
        });

        it('should return a domain error if kennung is not unique and type is schule', async () => {
            const name: string = faker.string.alpha();
            const kennung: string = faker.string.numeric({ length: 7 });
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                kennung: kennung,
                name: name,
            });
            const counted: Counted<Organisation<true>> = [[organisation], 1];
            organisationRepositoryMock.findById.mockResolvedValue(organisation as unknown as Organisation<true>);
            organisationRepositoryMock.findBy.mockResolvedValueOnce(counted);
            organisationRepositoryMock.save.mockResolvedValue(organisation as unknown as Organisation<true>);
            mapperMock.map.mockReturnValue(organisation as unknown as Dictionary<unknown>);

            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);

            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new SchuleKennungEindeutigError(),
            });
        });

        it('should return a domain error when organisation cannot be found on update', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true);
            organisationRepositoryMock.findById.mockResolvedValue(undefined);
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisation);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisation.id),
            });
        });

        it('should return domain error if name contains trailing space', async () => {
            const organisationDo: Organisation<true> = DoFactory.createOrganisation(true, { name: '  ' });
            organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if kennung contains trailing space', async () => {
            const organisationDo: Organisation<true> = DoFactory.createOrganisation(true, { kennung: 'kennung ' });
            organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if name contains trailing space', async () => {
            const organisationDo: Organisation<true> = DoFactory.createOrganisation(true, { name: '  ' });
            organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new NameForOrganisationWithTrailingSpaceError(),
            });
        });

        it('should return domain error if kennung contains trailing space', async () => {
            const organisationDo: Organisation<true> = DoFactory.createOrganisation(true, { kennung: 'kennung ' });
            organisationRepositoryMock.findById.mockResolvedValueOnce(DoFactory.createOrganisation(true));
            const result: Result<Organisation<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new KennungForOrganisationWithTrailingSpaceError(),
            });
        });
    });

    describe('findOrganisationById', () => {
        it('should find an organization by its ID', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true);
            organisationRepositoryMock.findById.mockResolvedValue(organisation);
            const result: Result<Organisation<true>> = await organisationService.findOrganisationById(organisation.id);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: true,
                value: organisation,
            });
        });

        it('should return a domain error', async () => {
            organisationRepositoryMock.findById.mockResolvedValue(null);
            const organisationId: string = faker.string.uuid();
            const result: Result<Organisation<true>> = await organisationService.findOrganisationById(organisationId);
            expect(result).toEqual<Result<Organisation<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organization', organisationId),
            });
        });
    });

    describe('findAllOrganizations', () => {
        describe('when organizations are found', () => {
            it('should return all organizations', async () => {
                const organisation: Organisation<true> = DoFactory.createOrganisation(true);
                const organisations: Organisation<true>[] = [organisation];
                const total: number = organisations.length;

                organisationRepositoryMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<Organisation<true>> = await organisationService.findAllOrganizations(organisation);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                    pageTotal: total,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const organisation: Organisation<false> = DoFactory.createOrganisation(false);

                organisationRepositoryMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<Organisation<true>> = await organisationService.findAllOrganizations(organisation);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });

    describe('setAdministriertVon', () => {
        it('should return a domain error if parent organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(false);

            const result: Result<void> = await organisationService.setAdministriertVon(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            });
        });

        it('should return a domain error if child organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(true);
            organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);

            const result: Result<void> = await organisationService.setAdministriertVon(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            });
        });

        it('should return a domain error if the organisation could not be updated', async () => {
            const rootDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepositoryMock.exists.mockResolvedValueOnce(true);
            organisationRepositoryMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInAdministriertVon

            organisationRepositoryMock.save.mockRejectedValueOnce(new Error());
            const result: Result<void> = await organisationService.setAdministriertVon(rootDo.id, traegerDo.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityCouldNotBeUpdated('Organisation', traegerDo.id),
            });
        });
    });

    describe('setZugehoerigZu', () => {
        it('should return a domain error if parent organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(false);

            const result: Result<void> = await organisationService.setZugehoerigZu(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            });
        });

        it('should return a domain error if child organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepositoryMock.exists.mockResolvedValueOnce(true);
            organisationRepositoryMock.findById.mockResolvedValueOnce(undefined);

            const result: Result<void> = await organisationService.setZugehoerigZu(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            });
        });

        it('should return a domain error if the organisation could not be updated', async () => {
            const rootDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepositoryMock.exists.mockResolvedValueOnce(true);
            organisationRepositoryMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInZugehoerigZu

            organisationRepositoryMock.save.mockRejectedValueOnce(new Error());
            const result: Result<void> = await organisationService.setZugehoerigZu(rootDo.id, traegerDo.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityCouldNotBeUpdated('Organisation', traegerDo.id),
            });
        });

        it('should return domain error if the organisation could not be updated', async () => {
            const rootDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: Organisation<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepositoryMock.exists.mockResolvedValueOnce(true);
            organisationRepositoryMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepositoryMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInZugehoerigZu

            organisationRepositoryMock.save.mockRejectedValueOnce(new Error());
            const result: Result<void> = await organisationService.setZugehoerigZu(rootDo.id, traegerDo.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityCouldNotBeUpdated('Organisation', traegerDo.id),
            });
        });
    });

    describe('findAllAdministriertVon', () => {
        describe('when organizations are found', () => {
            it('should return all organizations', async () => {
                const parentId: string = faker.string.uuid();
                const organisation: Organisation<true> = DoFactory.createOrganisation(true);
                const organisations: Organisation<true>[] = [organisation];
                const total: number = organisations.length;

                organisationRepositoryMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<Organisation<true>> = await organisationService.findAllAdministriertVon(parentId);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                    pageTotal: total,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const parentId: string = faker.string.uuid();
                organisationRepositoryMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<Organisation<true>> = await organisationService.findAllAdministriertVon(parentId);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });

    describe('findAllZugehoerigZu', () => {
        describe('when organizations are found', () => {
            it('should return all organizations', async () => {
                const parentId: string = faker.string.uuid();
                const organisation: Organisation<true> = DoFactory.createOrganisation(true);
                const organisations: Organisation<true>[] = [organisation];
                const total: number = organisations.length;

                organisationRepositoryMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<Organisation<true>> = await organisationService.findAllZugehoerigZu(parentId);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                    pageTotal: total,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const parentId: string = faker.string.uuid();
                organisationRepositoryMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<Organisation<true>> = await organisationService.findAllZugehoerigZu(parentId);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });
});
