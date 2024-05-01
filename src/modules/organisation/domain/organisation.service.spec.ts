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
import { OrganisationRepo } from '../persistence/organisation.repo.js';
import { OrganisationDo } from './organisation.do.js';
import { OrganisationService } from './organisation.service.js';
import { OrganisationsTyp } from './organisation.enums.js';
import { KennungRequiredForSchuleError } from '../specification/error/kennung-required-for-schule.error.js';

describe('OrganisationService', () => {
    let module: TestingModule;
    let organisationService: OrganisationService;
    let organisationRepoMock: DeepMocked<OrganisationRepo>;
    let mapperMock: DeepMocked<Mapper>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                OrganisationService,
                {
                    provide: OrganisationRepo,
                    useValue: createMock<OrganisationRepo>(),
                },
                {
                    provide: getMapperToken(),
                    useValue: createMock<Mapper>(),
                },
            ],
        }).compile();
        organisationService = module.get(OrganisationService);
        organisationRepoMock = module.get(OrganisationRepo);
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
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            organisationRepoMock.save.mockResolvedValue(organisationDo as unknown as OrganisationDo<true>);
            mapperMock.map.mockReturnValue(organisationDo as unknown as Dictionary<unknown>);
            const result: Result<OrganisationDo<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: true,
                value: organisationDo as unknown as OrganisationDo<true>,
            });
        });

        it('should return a domain error if first parent organisation does not exist', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            organisationDo.administriertVon = faker.string.uuid();
            organisationRepoMock.exists.mockResolvedValueOnce(false);

            const result: Result<OrganisationDo<true>> = await organisationService.createOrganisation(organisationDo);

            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisationDo.administriertVon),
            });
        });

        it('should return a domain error if second parent organisation does not exist', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            organisationDo.zugehoerigZu = faker.string.uuid();
            organisationRepoMock.exists.mockResolvedValueOnce(false);

            const result: Result<OrganisationDo<true>> = await organisationService.createOrganisation(organisationDo);

            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisationDo.zugehoerigZu),
            });
        });

        it('should return a domain error if kennung is not set and type is schule', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false, {
                typ: OrganisationsTyp.SCHULE,
                kennung: undefined,
            });
            organisationRepoMock.save.mockResolvedValue(organisationDo as unknown as OrganisationDo<true>);
            mapperMock.map.mockReturnValue(organisationDo as unknown as Dictionary<unknown>);

            const result: Result<OrganisationDo<true>> = await organisationService.createOrganisation(organisationDo);

            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new KennungRequiredForSchuleError(),
            });
        });

        it('should return a domain error', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            organisationDo.id = faker.string.uuid();
            const result: Result<OrganisationDo<true>> = await organisationService.createOrganisation(organisationDo);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityCouldNotBeCreated(`Organization could not be created`),
            });
        });
    });

    describe('updateOrganisation', () => {
        it('should update an organisation', async () => {
            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
            organisationRepoMock.save.mockResolvedValue(organisationDo as unknown as OrganisationDo<true>);
            const result: Result<OrganisationDo<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: true,
                value: organisationDo as unknown as OrganisationDo<true>,
            });
        });

        it('should return a domain error', async () => {
            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
            organisationDo.id = '';
            organisationRepoMock.findById.mockResolvedValue({} as Option<OrganisationDo<true>>);
            const result: Result<OrganisationDo<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityCouldNotBeUpdated(`Organization could not be updated`, organisationDo.id),
            });
        });

        it('should return a domain error if kennung is not set and type is schule', async () => {
            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
                kennung: undefined,
            });
            organisationRepoMock.findById.mockResolvedValue(organisationDo as unknown as OrganisationDo<true>);

            const result: Result<OrganisationDo<true>> = await organisationService.updateOrganisation(organisationDo);

            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new KennungRequiredForSchuleError(),
            });
        });

        it('should return a domain error when organisation cannot be found on update', async () => {
            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
            organisationRepoMock.findById.mockResolvedValue(undefined);
            const result: Result<OrganisationDo<true>> = await organisationService.updateOrganisation(organisationDo);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', organisationDo.id),
            });
        });
    });

    describe('findOrganisationById', () => {
        it('should find an organization by its ID', async () => {
            const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
            organisationRepoMock.findById.mockResolvedValue(organisationDo);
            const result: Result<OrganisationDo<true>> = await organisationService.findOrganisationById(
                organisationDo.id,
            );
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: true,
                value: organisationDo,
            });
        });

        it('should return a domain error', async () => {
            organisationRepoMock.findById.mockResolvedValue(null);
            const organisationId: string = faker.string.uuid();
            const result: Result<OrganisationDo<true>> = await organisationService.findOrganisationById(organisationId);
            expect(result).toEqual<Result<OrganisationDo<true>>>({
                ok: false,
                error: new EntityNotFoundError('Organization', organisationId),
            });
        });
    });

    describe('findAllOrganizations', () => {
        describe('when organizations are found', () => {
            it('should return all organizations', async () => {
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
                const organisations: OrganisationDo<true>[] = [organisationDo];
                const total: number = organisations.length;

                organisationRepoMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<OrganisationDo<true>> =
                    await organisationService.findAllOrganizations(organisationDo);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);

                organisationRepoMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<OrganisationDo<true>> =
                    await organisationService.findAllOrganizations(organisationDo);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });

    describe('setAdministriertVon', () => {
        it('should return a domain error if parent organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepoMock.exists.mockResolvedValueOnce(false);

            const result: Result<void> = await organisationService.setAdministriertVon(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            });
        });

        it('should return a domain error if child organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(undefined);

            const result: Result<void> = await organisationService.setAdministriertVon(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            });
        });

        it('should return a domain error if the organisation could not be updated', async () => {
            const rootDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInAdministriertVon

            organisationRepoMock.save.mockRejectedValueOnce(new Error());
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
            organisationRepoMock.exists.mockResolvedValueOnce(false);

            const result: Result<void> = await organisationService.setZugehoerigZu(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', parentId),
            });
        });

        it('should return a domain error if child organisation does not exist', async () => {
            const parentId: string = faker.string.uuid();
            const childId: string = faker.string.uuid();
            organisationRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(undefined);

            const result: Result<void> = await organisationService.setZugehoerigZu(parentId, childId);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityNotFoundError('Organisation', childId),
            });
        });

        it('should return a domain error if the organisation could not be updated', async () => {
            const rootDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInZugehoerigZu

            organisationRepoMock.save.mockRejectedValueOnce(new Error());
            const result: Result<void> = await organisationService.setZugehoerigZu(rootDo.id, traegerDo.id);

            expect(result).toEqual<Result<void>>({
                ok: false,
                error: new EntityCouldNotBeUpdated('Organisation', traegerDo.id),
            });
        });

        it('should return domain error if the organisation could not be updated', async () => {
            const rootDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '1',
                name: 'Root',
                administriertVon: undefined,
                zugehoerigZu: undefined,
                typ: OrganisationsTyp.TRAEGER,
            });
            const traegerDo: OrganisationDo<true> = DoFactory.createOrganisation(true, {
                id: '2',
                name: 'Träger1',
                administriertVon: '1',
                zugehoerigZu: '1',
                typ: OrganisationsTyp.TRAEGER,
            });

            organisationRepoMock.exists.mockResolvedValueOnce(true);
            organisationRepoMock.findById.mockResolvedValueOnce(traegerDo);
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in TraegerAdministriertVonTraeger
            organisationRepoMock.findById.mockResolvedValueOnce(rootDo); //called in ZyklusInZugehoerigZu

            organisationRepoMock.save.mockRejectedValueOnce(new Error());
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
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
                const organisations: OrganisationDo<true>[] = [organisationDo];
                const total: number = organisations.length;

                organisationRepoMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<OrganisationDo<true>> = await organisationService.findAllAdministriertVon(parentId);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const parentId: string = faker.string.uuid();
                organisationRepoMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<OrganisationDo<true>> = await organisationService.findAllAdministriertVon(parentId);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });

    describe('findAllZugehoerigZu', () => {
        describe('when organizations are found', () => {
            it('should return all organizations', async () => {
                const parentId: string = faker.string.uuid();
                const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);
                const organisations: OrganisationDo<true>[] = [organisationDo];
                const total: number = organisations.length;

                organisationRepoMock.findBy.mockResolvedValue([organisations, total]);

                const result: Paged<OrganisationDo<true>> = await organisationService.findAllZugehoerigZu(parentId);

                expect(result).toEqual({
                    total: total,
                    offset: 0,
                    limit: total,
                    items: organisations,
                });
            });
        });

        describe('when no organizations are found', () => {
            it('should return an empty list of organizations', async () => {
                const parentId: string = faker.string.uuid();
                organisationRepoMock.findBy.mockResolvedValue([[], 0]);

                const result: Paged<OrganisationDo<true>> = await organisationService.findAllZugehoerigZu(parentId);

                expect(result.items).toHaveLength(0);
                expect(result.items).toBeInstanceOf(Array);
            });
        });
    });
});
