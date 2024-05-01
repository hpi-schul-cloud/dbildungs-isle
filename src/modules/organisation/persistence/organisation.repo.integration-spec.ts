import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DatabaseTestModule,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { OrganisationDo } from '../domain/organisation.do.js';
import { OrganisationPersistenceMapperProfile } from './organisation-persistence.mapper.profile.js';
import { OrganisationEntity } from './organisation.entity.js';
import { OrganisationRepo } from './organisation.repo.js';
import { OrganisationScope } from './organisation.scope.js';
import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';

describe('OrganisationRepo', () => {
    let module: TestingModule;
    let sut: OrganisationRepo;
    let orm: MikroORM;
    let em: EntityManager;
    let mapper: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [OrganisationPersistenceMapperProfile, OrganisationRepo],
        }).compile();
        sut = module.get(OrganisationRepo);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        mapper = module.get(getMapperToken());
        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('save', () => {
        it('should create an organisation', async () => {
            const organisation: OrganisationDo<false> = DoFactory.createOrganisation(false);
            await sut.save(organisation);
            await expect(em.find(OrganisationEntity, {})).resolves.toHaveLength(1);
        });

        it('should create an organisation', async () => {
            const newOrganisation: OrganisationDo<false> = DoFactory.createOrganisation(false);
            const savedOrganisation: OrganisationDo<true> = await sut.save(newOrganisation);
            await expect(em.find(OrganisationEntity, { id: savedOrganisation.id })).resolves.toHaveLength(1);
        });

        it('should update an organisation and should not create a new organisation', async () => {
            const newOrganisation: OrganisationDo<true> = DoFactory.createOrganisation(true);
            const savedOrganisation: OrganisationDo<true> = await sut.save(newOrganisation);
            await expect(em.find(OrganisationEntity, {})).resolves.toHaveLength(1);
            await sut.save(savedOrganisation);
            await expect(em.find(OrganisationEntity, {})).resolves.toHaveLength(1);
        });
    });

    describe('exists', () => {
        it('should find an organization by ID', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            const organisation: OrganisationDo<boolean> = await sut.save(organisationDo);
            const orgExists: boolean = await sut.exists(organisation.id as string);
            expect(orgExists).toBe(true);
        });

        it('should return false', async () => {
            const orgExists: boolean = await sut.exists(faker.string.uuid());
            expect(orgExists).toBe(false);
        });
    });

    describe('findById', () => {
        it('should find an organization by ID', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            const organisation: OrganisationDo<boolean> = await sut.save(organisationDo);
            const foundOrganisation: Option<OrganisationDo<true>> = await sut.findById(organisation.id as string);
            expect(foundOrganisation).toBeInstanceOf(OrganisationDo);
        });

        it('should return null', async () => {
            const foundOrganisation: Option<OrganisationDo<true>> = await sut.findById(faker.string.uuid());
            expect(foundOrganisation).toBeNull();
        });
    });

    describe('findByIds', () => {
        it('should find organizations by IDs', async () => {
            const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
            const organisation: OrganisationDo<boolean> = await sut.save(organisationDo);
            const foundOrganisations: Map<string, OrganisationDo<true>> = await sut.findByIds([
                organisation.id as string,
            ]);
            expect(foundOrganisations).toBeInstanceOf(Map<string, OrganisationDo<true>>);
        });
    });

    describe('findBy', () => {
        describe('when matching organisations were found by scope', () => {
            it('should return found organizations', async () => {
                const props: Partial<OrganisationDo<true>> = {
                    kennung: faker.lorem.word(),
                    name: faker.lorem.word(),
                };
                const organisationDos: OrganisationDo<true>[] = DoFactory.createMany(
                    2,
                    true,
                    DoFactory.createOrganisation,
                    props,
                );

                await em.persistAndFlush(mapper.mapArray(organisationDos, OrganisationDo, OrganisationEntity));

                const [result]: Counted<OrganisationDo<true>> = await sut.findBy(
                    new OrganisationScope().findBy({
                        kennung: organisationDos[0]?.kennung as string,
                        name: organisationDos[0]?.name as string,
                    }),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(2);
                await expect(em.find(OrganisationEntity, {})).resolves.toHaveLength(2);
            });
        });

        describe('when no organisations were found', () => {
            it('should return an empty array', async () => {
                const [result]: Counted<OrganisationDo<true>> = await sut.findBy(new OrganisationScope());

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(0);
                await expect(em.find(OrganisationEntity, {})).resolves.toHaveLength(0);
            });
        });
    });

    describe('findByNameOrKennung', () => {
        describe('when matching organisations were found', () => {
            it('should return found organizations', async () => {
                const organisationDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
                const organisation: OrganisationDo<boolean> = await sut.save(organisationDo);
                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findByNameOrKennung(
                    organisation.name as string,
                );
                expect(foundOrganisations).toBeInstanceOf(Array);
                expect(foundOrganisations).toHaveLength(1);
            });
        });

        describe('when no matching organisations were found', () => {
            it('should return null', async () => {
                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findByNameOrKennung('notExisting');
                expect(foundOrganisations).toBeInstanceOf(Array);
                expect(foundOrganisations).toHaveLength(0);
            });
        });
    });

    describe('findChildOrgasByIds', () => {
        describe('when not root', () => {
            it('should return found childs for root', async () => {
                const organisationRootDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
                const organisationRoot: OrganisationDo<boolean> = await sut.save(organisationRootDo);

                if (!organisationRoot.id) {
                    return;
                }

                const organisationChild1Level1Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                const organisationChild2Level1Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                organisationChild1Level1Do.administriertVon = organisationRoot.id;
                organisationChild2Level1Do.administriertVon = organisationRoot.id;
                const organisationChild1Level1: OrganisationDo<boolean> = await sut.save(organisationChild1Level1Do);
                const organisationChild2Level1: OrganisationDo<boolean> = await sut.save(organisationChild2Level1Do);

                if (!organisationChild1Level1.id || !organisationChild2Level1.id) {
                    return;
                }

                const organisationChild1Level2Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                organisationChild1Level2Do.administriertVon = organisationChild1Level1.id;
                await sut.save(organisationChild1Level2Do);

                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findChildOrgasForIds([
                    organisationChild1Level1.id,
                ]);
                expect(foundOrganisations).toBeInstanceOf(Array);
                expect(foundOrganisations).toHaveLength(1);
            });
        });

        describe('when root', () => {
            it('should return found childs for root', async () => {
                const organisationRootDo: OrganisationDo<false> = DoFactory.createOrganisation(false);
                organisationRootDo.id = sut.ROOT_ORGANISATION_ID;
                const organisationRoot: OrganisationDo<boolean> = await sut.save(organisationRootDo);

                if (!organisationRoot.id) {
                    return;
                }

                const organisationChild1Level1Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                const organisationChild2Level1Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                organisationChild1Level1Do.administriertVon = organisationRoot.id;
                organisationChild2Level1Do.administriertVon = organisationRoot.id;
                const organisationChild1Level1: OrganisationDo<boolean> = await sut.save(organisationChild1Level1Do);
                const organisationChild2Level1: OrganisationDo<boolean> = await sut.save(organisationChild2Level1Do);

                if (!organisationChild1Level1.id || !organisationChild2Level1.id) {
                    return;
                }

                const organisationChild1Level2Do: OrganisationDo<false> = DoFactory.createOrganisation(false);
                organisationChild1Level2Do.administriertVon = organisationChild1Level1.id;
                await sut.save(organisationChild1Level2Do);

                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findChildOrgasForIds([
                    organisationRoot.id,
                ]);
                expect(foundOrganisations).toBeInstanceOf(Array);
                expect(foundOrganisations).toHaveLength(3);
            });
        });

        describe('empty input', () => {
            it('should return null', async () => {
                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findChildOrgasForIds([]);
                expect(foundOrganisations).toEqual([]);
            });
        });

        describe('does not exist', () => {
            it('should return null', async () => {
                const foundOrganisations: Option<OrganisationDo<true>[]> = await sut.findChildOrgasForIds([
                    faker.string.uuid(),
                ]);
                expect(foundOrganisations).toEqual([]);
            });
        });
    });
});
