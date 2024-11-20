import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM, RequiredEntityData } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
    LoggingTestModule,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { mapAggregateToData, mapEntityToAggregate, OrganisationRepository } from './organisation.repository.js';
import { OrganisationPersistenceMapperProfile } from './organisation-persistence.mapper.profile.js';
import { OrganisationEntity } from './organisation.entity.js';
import { Organisation } from '../domain/organisation.js';
import { OrganisationScope } from './organisation.scope.js';
import { OrganisationsTyp, RootDirectChildrenType } from '../domain/organisation.enums.js';
import { ScopeOperator } from '../../../shared/persistence/index.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { DataConfig } from '../../../shared/config/index.js';
import { EventService } from '../../../core/eventbus/services/event.service.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { EntityCouldNotBeUpdated } from '../../../shared/error/entity-could-not-be-updated.error.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { OrganisationUpdateOutdatedError } from '../domain/orga-update-outdated.error.js';

describe('OrganisationRepository', () => {
    let module: TestingModule;
    let sut: OrganisationRepository;
    let orm: MikroORM;
    let em: EntityManager;
    let config: ConfigService<ServerConfig>;
    let ROOT_ORGANISATION_ID: string;
    let eventServiceMock: DeepMocked<EventService>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                LoggingTestModule,
                ConfigTestModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                MapperTestModule,
            ],
            providers: [
                OrganisationPersistenceMapperProfile,
                OrganisationRepository,
                {
                    provide: EventService,
                    useValue: createMock<EventService>(),
                },
            ],
        }).compile();
        sut = module.get(OrganisationRepository);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        config = module.get(ConfigService<ServerConfig>);
        eventServiceMock = module.get(EventService);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeAll(() => {
        ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('findById', () => {
        it('should return one organisation by id', async () => {
            const orga: Organisation<false> | DomainError = Organisation.createNew();
            if (orga instanceof DomainError) {
                return;
            }
            const organisaiton: Organisation<true> = await sut.save(orga);
            const foundOrganisation: Option<Organisation<true>> = await sut.findById(organisaiton.id);

            expect(foundOrganisation).toBeTruthy();
            expect(foundOrganisation).toEqual(organisaiton);
        });

        it('should return undefined when organisation cannot be found', async () => {
            const foundOrganisation: Option<Organisation<true>> = await sut.findById(faker.string.uuid());
            expect(foundOrganisation).toBeFalsy();
            expect(foundOrganisation).toBeNull();
        });
    });

    describe('mapAggregateToData', () => {
        it('should return Person RequiredEntityData', () => {
            const organisation: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.lorem.word(),
                faker.string.uuid(),
                undefined,
                undefined,
            );

            const expectedProperties: string[] = [
                'administriertVon',
                'zugehoerigZu',
                'kennung',
                'name',
                'namensergaenzung',
                'kuerzel',
                'typ',
                'traegerschaft',
            ];

            const result: RequiredEntityData<OrganisationEntity> = mapAggregateToData(organisation);

            expectedProperties.forEach((prop: string) => {
                expect(result).toHaveProperty(prop);
            });
        });
    });

    describe('mapEntityToAggregate', () => {
        it('should return New Aggregate', () => {
            const organisationEntity: OrganisationEntity = em.create(
                OrganisationEntity,
                mapAggregateToData(DoFactory.createOrganisation(true)),
            );
            const organisation: Organisation<true> = mapEntityToAggregate(organisationEntity);

            expect(organisation).toBeInstanceOf(Organisation);
        });
    });

    describe('exists', () => {
        it('should return true if the orga exists', async () => {
            const orga: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orga instanceof DomainError) {
                return;
            }

            const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));

            await em.persistAndFlush(mappedOrga);

            await expect(sut.exists(mappedOrga.id)).resolves.toBe(true);
        });

        it('should return false if the orga does not exists', async () => {
            await expect(sut.exists(faker.string.uuid())).resolves.toBe(false);
        });
    });

    describe('findById', () => {
        it('should return the organisation if it exists', async () => {
            const orga: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orga instanceof DomainError) {
                return;
            }

            const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));

            await em.persistAndFlush(mappedOrga);

            await expect(sut.findById(mappedOrga.id)).resolves.toBeInstanceOf(Organisation);
        });

        it('should return null', async () => {
            await expect(sut.findById(faker.string.uuid())).resolves.toBeNull();
        });
    });

    describe('findBy', () => {
        let organisation1: Organisation<false>;
        let organisation2: Organisation<false>;
        let organisation3: Organisation<false>;
        let organisationEntity1: OrganisationEntity;
        let organisationEntity2: OrganisationEntity;
        let organisationEntity3: OrganisationEntity;

        beforeEach(async () => {
            organisation1 = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                '05674',
                'Name1',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            organisation2 = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                '44123',
                'Name2',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );
            organisation3 = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                '75693',
                'TestSchule',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            organisationEntity1 = em.create(OrganisationEntity, mapAggregateToData(organisation1));
            organisationEntity2 = em.create(OrganisationEntity, mapAggregateToData(organisation2));
            organisationEntity3 = em.create(OrganisationEntity, mapAggregateToData(organisation3));
            await em.persistAndFlush([organisationEntity1, organisationEntity2, organisationEntity3]);
        });

        afterEach(async () => {
            await em.removeAndFlush([organisationEntity1, organisationEntity2]);
        });
        describe('When Called Only With searchString', () => {
            it('should return Correct Aggregates By SearchString', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope().searchString(organisation1.kennung),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(1);
                expect(result.at(0)?.kennung).toEqual(organisation1.kennung);
            });

            it('should return Correct Aggregates By SearchString', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope().searchString('Name2'),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(1);
                expect(result.at(0)?.kennung).toEqual(organisation2.kennung);
            });

            it('should return Correct Aggregates By SearchString', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope().searchString('Name'),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(2);
            });
        });
        describe('When Called Only With filters', () => {
            it('should return Correct Aggregates By Filters', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope().findBy({
                        kennung: organisation1.kennung as string,
                    }),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(1);
                expect(result.at(0)?.kennung).toEqual(organisation1.kennung);
            });

            it('should return Correct Aggregates By Filters', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope().findBy({
                        typ: OrganisationsTyp.SCHULE as string,
                    }),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(2);
            });
        });
        describe('When Called With searchString & filters and scopeWhere Operator AND', () => {
            it('should return Correct Aggregates By Filters AND searchString', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope()
                        .findBy({
                            typ: OrganisationsTyp.SCHULE as string,
                        })
                        .setScopeWhereOperator(ScopeOperator.AND)
                        .searchString('Test'),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(1);
                expect(result.at(0)?.kennung).toEqual(organisation3.kennung);
            });
        });

        describe('When Called With searchString & filters and scopeWhere Operator OR', () => {
            it('should return Correct Aggregates By Filters OR searchString', async () => {
                const [result]: Counted<Organisation<true>> = await sut.findBy(
                    new OrganisationScope()
                        .findBy({
                            typ: OrganisationsTyp.SCHULE as string,
                        })
                        .setScopeWhereOperator(ScopeOperator.OR)
                        .searchString('Test'),
                );

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(2);
            });
        });
    });

    describe('findChildOrgasByIds', () => {
        async function createOrgaTree(): Promise<[root: string, traeger: string, schule: string]> {
            const root: Organisation<true> = Organisation.construct(
                sut.ROOT_ORGANISATION_ID,
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                undefined,
                undefined,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );

            const traeger: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                root.id,
                root.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );

            const schule: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                traeger.id,
                traeger.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );

            await em.persistAndFlush([
                em.create(OrganisationEntity, mapAggregateToData(root)),
                em.create(OrganisationEntity, mapAggregateToData(traeger)),
                em.create(OrganisationEntity, mapAggregateToData(schule)),
            ]);

            return [root.id, traeger.id, schule.id];
        }

        describe('when no input IDs are given', () => {
            it('should return empty array', async () => {
                const result: Organisation<true>[] = await sut.findChildOrgasForIds([]);

                expect(result).toHaveLength(0);
            });
        });

        describe('when root organisation', () => {
            it('should return all organisations', async () => {
                const [rootId]: [string, string, string] = await createOrgaTree();

                const result: Organisation<true>[] = await sut.findChildOrgasForIds([rootId]);

                expect(result).toHaveLength(2);
            });
        });

        describe('when not root organisation', () => {
            it('should return all child organisations', async () => {
                const [, traegerId]: [string, string, string] = await createOrgaTree();

                const result: Organisation<true>[] = await sut.findChildOrgasForIds([traegerId]);

                expect(result).toHaveLength(1);
            });
        });

        it('should map column names correctly', async () => {
            const [, traegerId]: [string, string, string] = await createOrgaTree();

            const result: Organisation<true>[] = await sut.findChildOrgasForIds([traegerId]);

            expect(result).toHaveLength(1);
            expect(result[0]?.createdAt).not.toBeUndefined();
            expect(result[0]?.updatedAt).not.toBeUndefined();
            expect(result[0]?.administriertVon).not.toBeUndefined();
            expect(result[0]?.zugehoerigZu).not.toBeUndefined();
        });
    });

    describe('findEmailDomainForOrganisation', () => {
        type CreateOrgaTreeResult = {
            root: Organisation<true>;
            traeger: Organisation<true>;
            schule: Organisation<true>;
        };
        async function createOrgaTreeWithDomains(
            rootDomain?: string,
            traegerDomain?: string,
            schuleDomain?: string,
        ): Promise<CreateOrgaTreeResult> {
            const root: Organisation<true> = Organisation.construct(
                sut.ROOT_ORGANISATION_ID,
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                undefined,
                undefined,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
                rootDomain,
            );

            const traeger: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                root.id,
                root.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
                traegerDomain,
            );

            const schule: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                traeger.id,
                traeger.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
                schuleDomain,
            );

            await em.persistAndFlush([
                em.create(OrganisationEntity, mapAggregateToData(root)),
                em.create(OrganisationEntity, mapAggregateToData(traeger)),
                em.create(OrganisationEntity, mapAggregateToData(schule)),
            ]);

            return { root, traeger, schule };
        }

        const domain: string = 'schule-sh.de';

        it('should return emailDomain for root provided by root', async () => {
            const { root }: CreateOrgaTreeResult = await createOrgaTreeWithDomains(domain, undefined, undefined);

            const result: string | undefined = await sut.findEmailDomainForOrganisation(root.id);

            expect(result).toBeDefined();
            expect(result).toStrictEqual(domain);
        });

        it('should return emailDomain for schule provided by traeger', async () => {
            const { root, traeger, schule }: CreateOrgaTreeResult = await createOrgaTreeWithDomains(
                undefined,
                domain,
                undefined,
            );

            const result: string | undefined = await sut.findEmailDomainForOrganisation(traeger.id);

            expect(root).toBeDefined();
            expect(schule).toBeDefined();
            expect(result).toBeDefined();
            expect(result).toStrictEqual(domain);
        });

        it('should return emailDomain for schule provided by root', async () => {
            const { root, traeger, schule }: CreateOrgaTreeResult = await createOrgaTreeWithDomains(
                domain,
                undefined,
                undefined,
            );

            const result: string | undefined = await sut.findEmailDomainForOrganisation(schule.id);

            expect(root).toBeDefined();
            expect(traeger).toBeDefined();
            expect(result).toBeDefined();
            expect(result).toStrictEqual(domain);
        });

        it('should return undefined when NO organisation in tree has an email-domain', async () => {
            const { root, traeger, schule }: CreateOrgaTreeResult = await createOrgaTreeWithDomains(
                undefined,
                undefined,
                undefined,
            );

            const result: string | undefined = await sut.findEmailDomainForOrganisation(schule.id);

            expect(root).toBeDefined();
            expect(traeger).toBeDefined();
            expect(schule).toBeDefined();
            expect(result).toBeUndefined();
        });

        // This test covers getDomainRecursive, case 'no organisations, first cancel condition'
        it('should return undefined when NO organisation were found via findParentOrgasForIdSortedByDepthAsc', async () => {
            //no tree-creation here -> mocks no organisations could be found
            const result: string | undefined = await sut.findEmailDomainForOrganisation(faker.string.uuid());

            expect(result).toBeUndefined();
        });
    });

    describe('findParentOrgas-Methods', () => {
        type CreateOrgaTreeResult = {
            root: Organisation<true>;
            traeger: Organisation<true>;
            schule: Organisation<true>;
        };
        async function createOrgaTree(): Promise<CreateOrgaTreeResult> {
            const root: Organisation<true> = Organisation.construct(
                sut.ROOT_ORGANISATION_ID,
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                undefined,
                undefined,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
            );

            const traeger: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                root.id,
                root.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
            );

            const schule: Organisation<true> = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                traeger.id,
                traeger.id,
                faker.string.numeric(6),
                faker.string.alphanumeric(10),
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
            );

            await em.persistAndFlush([
                em.create(OrganisationEntity, mapAggregateToData(root)),
                em.create(OrganisationEntity, mapAggregateToData(traeger)),
                em.create(OrganisationEntity, mapAggregateToData(schule)),
            ]);

            return { root, traeger, schule };
        }

        describe('findParentOrgasForIds', () => {
            describe('when no input IDs are given', () => {
                it('should return empty array', async () => {
                    const result: Organisation<true>[] = await sut.findParentOrgasForIds([]);

                    expect(result).toHaveLength(0);
                });
            });

            describe('when leaf organisation', () => {
                it('should return all organisations', async () => {
                    const { schule }: CreateOrgaTreeResult = await createOrgaTree();

                    const result: Organisation<true>[] = await sut.findParentOrgasForIds([schule.id]);

                    expect(result).toHaveLength(3);
                });
            });

            describe('when multiple organisation', () => {
                it('should not return duplicate organisations', async () => {
                    const { root, traeger, schule }: CreateOrgaTreeResult = await createOrgaTree();

                    const result: Organisation<true>[] = await sut.findParentOrgasForIds([
                        root.id,
                        traeger.id,
                        schule.id,
                    ]);

                    expect(result).toHaveLength(3);
                });
            });

            describe('when root organisation', () => {
                it('should return only root', async () => {
                    const { root }: CreateOrgaTreeResult = await createOrgaTree();

                    const result: Organisation<true>[] = await sut.findParentOrgasForIds([root.id]);

                    expect(result).toHaveLength(1);
                });
            });
        });

        describe('findParentOrgasForIdSorted', () => {
            describe('when leaf organisation', () => {
                it('should return all organisations sorted by depth asc', async () => {
                    const { root, traeger, schule }: CreateOrgaTreeResult = await createOrgaTree();

                    const result: Organisation<true>[] = await sut.findParentOrgasForIdSortedByDepthAsc(schule.id);

                    expect(result).toHaveLength(3);
                    expect(result[0]).toMatchObject({
                        id: schule.id,
                    });
                    expect(result[1]).toMatchObject({
                        id: traeger.id,
                    });
                    expect(result[2]).toMatchObject({
                        id: root.id,
                    });
                });
            });

            describe('when root organisation', () => {
                it('should return only root', async () => {
                    const { root }: CreateOrgaTreeResult = await createOrgaTree();

                    const result: Organisation<true>[] = await sut.findParentOrgasForIdSortedByDepthAsc(root.id);

                    expect(result).toHaveLength(1);
                });
            });
        });

        it('should map column names correctly', async () => {
            const { root }: CreateOrgaTreeResult = await createOrgaTree();

            const result: Organisation<true>[] = await sut.findParentOrgasForIds([root.id]);

            expect(result).toHaveLength(1);
            expect(result[0]?.createdAt).not.toBeUndefined();
            expect(result[0]?.updatedAt).not.toBeUndefined();
        });
    });

    describe('findRootDirectChildren', () => {
        let root: Organisation<false>;
        let oeffentlich: Organisation<false>;
        let ersatz: Organisation<false>;
        let organisationEntity1: OrganisationEntity;
        let organisationEntity2: OrganisationEntity;
        let organisationEntity3: OrganisationEntity;

        beforeEach(async () => {
            root = Organisation.construct(
                ROOT_ORGANISATION_ID,
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.numeric(),
                'Root',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            oeffentlich = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                ROOT_ORGANISATION_ID,
                faker.string.uuid(),
                faker.string.numeric(),
                'Öffentliche Schulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );
            ersatz = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                ROOT_ORGANISATION_ID,
                faker.string.uuid(),
                faker.string.numeric(),
                'Ersatzschulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            organisationEntity1 = em.create(OrganisationEntity, mapAggregateToData(root));
            organisationEntity2 = em.create(OrganisationEntity, mapAggregateToData(oeffentlich));
            organisationEntity3 = em.create(OrganisationEntity, mapAggregateToData(ersatz));
            await em.persistAndFlush([organisationEntity1, organisationEntity2, organisationEntity3]);
        });

        describe('When Called', () => {
            it('should return flaged oeffentlich & ersatz root nodes', async () => {
                const result: [Organisation<true> | undefined, Organisation<true> | undefined] =
                    await sut.findRootDirectChildren();

                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(2);
            });
        });
    });

    describe('deleteKlasse', () => {
        describe('when all validations succeed', () => {
            it('should succeed', async () => {
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                });
                const savedOrganisaiton: Organisation<true> = await sut.save(organisation);

                await sut.deleteKlasse(savedOrganisaiton.id);
                const exists: boolean = await sut.exists(savedOrganisaiton.id);

                expect(exists).toBe(false);
            });
        });

        describe('when organisation does not exist', () => {
            it('should return EntityNotFoundError', async () => {
                const id: string = faker.string.uuid();
                const result: Option<DomainError> = await sut.deleteKlasse(id);
                expect(result).toEqual(new EntityNotFoundError('Organisation', id));
            });
        });

        describe('when organisation is not a Klasse', () => {
            it('should return EntityCouldNotBeUpdated', async () => {
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.SONSTIGE,
                    name: 'test',
                });
                const savedOrganisaiton: Organisation<true> = await sut.save(organisation);

                const result: Option<DomainError> = await sut.deleteKlasse(savedOrganisaiton.id);

                expect(result).toBeInstanceOf(EntityCouldNotBeUpdated);
            });
        });
    });
    describe('updateKlassenname', () => {
        describe('when organisation does not exist', () => {
            it('should return EntityNotFoundError', async () => {
                const id: string = faker.string.uuid();
                const result: DomainError | Organisation<true> = await sut.updateKlassenname(
                    id,
                    faker.company.name(),
                    faker.number.int(),
                );

                expect(result).toEqual(new EntityNotFoundError('Organisation', id));
            });
        });

        describe('when organisation is not a Klasse', () => {
            it('should return EntityCouldNotBeUpdated', async () => {
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.SONSTIGE,
                    name: 'test',
                    version: faker.number.int(),
                });
                const savedOrganisaiton: Organisation<true> = await sut.save(organisation);
                const result: DomainError | Organisation<true> = await sut.updateKlassenname(
                    savedOrganisaiton.id,
                    faker.company.name(),
                    faker.number.int(),
                );

                expect(result).toBeInstanceOf(EntityCouldNotBeUpdated);
            });
        });

        describe('when name of organisation is empty', () => {
            it('should return OrganisationSpecificationError', async () => {
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                    name: 'test',
                });
                const savedOrganisaiton: Organisation<true> = await sut.save(organisation);
                const result: DomainError | Organisation<true> = await sut.updateKlassenname(
                    savedOrganisaiton.id,
                    '',
                    faker.number.int(),
                );

                expect(result).toBeInstanceOf(OrganisationSpecificationError);
            });
        });

        describe('when all validations are passed', () => {
            it('should update class name and return void', async () => {
                const parentOrga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    typ: OrganisationsTyp.SCHULE,
                    version: 1,
                });
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                    name: 'name',
                    administriertVon: parentOrga.id,
                    version: 1,
                });
                const otherChildOrga: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                    name: 'nameOther',
                    administriertVon: parentOrga.id,
                    version: 1,
                });

                const organisationEntity1: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(parentOrga),
                );
                const organisationEntity2: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(organisation),
                );
                const organisationEntity3: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(otherChildOrga),
                );
                await em.persistAndFlush([organisationEntity1, organisationEntity2, organisationEntity3]);
                em.clear();
                const result: DomainError | Organisation<true> = await sut.updateKlassenname(
                    organisationEntity2.id,
                    'newName',
                    1,
                );

                expect(result).not.toBeInstanceOf(DomainError);
            });
        });

        describe('Should throw an error', () => {
            it('should throw OptimisticLockError when concurrent updates cause version mismatch', async () => {
                // Setup: Create initial organization
                const parentOrga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    typ: OrganisationsTyp.SCHULE,
                    version: 1,
                });
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                    name: 'name',
                    administriertVon: parentOrga.id,
                    version: 1,
                });

                // Create and persist entities
                const organisationEntity1: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(parentOrga),
                );
                const organisationEntity2: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(organisation),
                );

                await em.persistAndFlush([organisationEntity1, organisationEntity2]);
                em.clear();

                // Simulate concurrent updates:
                // 1. First update
                await sut.updateKlassenname(organisationEntity2.id, 'newName1', 1);

                // 2. Try second update with original version (should fail)
                await expect(async () => {
                    await sut.updateKlassenname(
                        organisationEntity2.id,
                        'newName2',
                        1, // This is now outdated because previous update incremented it
                    );
                }).rejects.toThrow(OrganisationUpdateOutdatedError);
            });
        });
        describe('when name did not change', () => {
            it('should not check specifications, update class name and return void', async () => {
                const parentOrga: Organisation<true> = DoFactory.createOrganisationAggregate(true, {
                    typ: OrganisationsTyp.SCHULE,
                    version: 1,
                });
                const organisation: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    typ: OrganisationsTyp.KLASSE,
                    name: 'name',
                    administriertVon: parentOrga.id,
                    version: 1,
                });

                const organisationEntity1: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(parentOrga),
                );
                const organisationEntity2: OrganisationEntity = em.create(
                    OrganisationEntity,
                    mapAggregateToData(organisation),
                );
                await em.persistAndFlush([organisationEntity1, organisationEntity2]);

                const result: DomainError | Organisation<true> = await sut.updateKlassenname(
                    organisationEntity2.id,
                    'name',
                    1,
                );

                expect(result).not.toBeInstanceOf(DomainError);
            });
        });
    });

    describe('setEnabledForitslearning', () => {
        it('should enable organisation for itslearning', async () => {
            const orga: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
                undefined,
                undefined,
                OrganisationsTyp.SCHULE,
            );
            if (orga instanceof DomainError) throw orga;

            const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
            await em.persistAndFlush(mappedOrga);

            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

            const result: Organisation<true> | DomainError = await sut.setEnabledForitslearning(
                personPermissions,
                mappedOrga.id,
            );
            if (result instanceof DomainError) throw Error();

            expect(result.itslearningEnabled).toBeTruthy();
        });

        it('should return error if permissions are not sufficient to edit organisation', async () => {
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.hasSystemrechteAtRootOrganisation.mockResolvedValue(false);

            const fakeId: string = faker.string.uuid();
            const result: Organisation<true> | DomainError = await sut.setEnabledForitslearning(
                personPermissions,
                fakeId,
            );

            expect(result).toStrictEqual(new EntityNotFoundError('Organisation', fakeId));
        });

        it('should throw error if organisation CANNOT be found by id', async () => {
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.hasSystemrechteAtRootOrganisation.mockResolvedValue(true);

            const fakeId: string = faker.string.uuid();
            const result: Organisation<true> | DomainError = await sut.setEnabledForitslearning(
                personPermissions,
                fakeId,
            );

            expect(result).toStrictEqual(new EntityNotFoundError('Organisation', fakeId));
        });

        it('should return error if organisation-typ is NOT Schule', async () => {
            const orga: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
                undefined,
                undefined,
                OrganisationsTyp.KLASSE,
            );
            if (orga instanceof DomainError) {
                return;
            }
            const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
            await em.persistAndFlush(mappedOrga);

            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

            const result: Organisation<true> | DomainError = await sut.setEnabledForitslearning(
                personPermissions,
                mappedOrga.id,
            );

            expect(result).toStrictEqual(
                new EntityCouldNotBeUpdated('Organisation', mappedOrga.id, [
                    'Only organisations of typ SCHULE can be enabled for ITSLearning.',
                ]),
            );
        });
    });

    describe('findByNameOrKennung', () => {
        let organisations: Organisation<false>[];

        beforeEach(async () => {
            organisations = [
                DoFactory.createOrganisationAggregate(false, {
                    name: 'TestName1',
                    kennung: 'KENNUNG1',
                }),
                DoFactory.createOrganisationAggregate(false, { name: 'AnotherTest', kennung: 'KENNUNG2' }),
                DoFactory.createOrganisationAggregate(false, { name: 'TestName2', kennung: 'DIFFERENTKENNUNG' }),
            ];
            /* eslint-disable no-await-in-loop */
            for (const organisation of organisations) {
                await sut.save(organisation);
            }
            /* eslint-disable no-await-in-loop */
        });

        it('should return organisations that match the search string in name', async () => {
            const result: Organisation<true>[] = await sut.findByNameOrKennung('TestName');
            expect(result).toHaveLength(2);
            expect(result.some((org: Organisation<true>) => org.name === 'TestName1')).toBeTruthy();
            expect(result.some((org: Organisation<true>) => org.name === 'TestName2')).toBeTruthy();
        });

        it('should return organisations that match the search string in kennung', async () => {
            const result: Organisation<true>[] = await sut.findByNameOrKennung('KENNUNG2');
            expect(result).toHaveLength(1);
            expect(result[0]?.kennung).toEqual('KENNUNG2');
        });

        it('should return organisations that match the search string in either name or kennung', async () => {
            const result: Organisation<true>[] = await sut.findByNameOrKennung('AnotherTest');
            expect(result).toHaveLength(1);
            expect(result[0]?.name).toEqual('AnotherTest');
        });

        it('should return an empty array if no organisations match the search string', async () => {
            const result: Organisation<true>[] = await sut.findByNameOrKennung('NoMatch');
            expect(result).toHaveLength(0);
        });
    });

    describe('Save', () => {
        let root: Organisation<false>;
        let oeffentlich: Organisation<false>;
        let ersatz: Organisation<false>;
        let organisationEntity1: OrganisationEntity;
        let organisationEntity2: OrganisationEntity;
        let organisationEntity3: OrganisationEntity;

        beforeEach(async () => {
            root = Organisation.construct(
                ROOT_ORGANISATION_ID,
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                faker.string.uuid(),
                faker.string.uuid(),
                faker.string.numeric(),
                'Root',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            oeffentlich = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                ROOT_ORGANISATION_ID,
                faker.string.uuid(),
                faker.string.numeric(),
                'Öffentliche Schulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.ROOT,
                undefined,
            );
            ersatz = Organisation.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.number.int(),
                ROOT_ORGANISATION_ID,
                faker.string.uuid(),
                faker.string.numeric(),
                'Ersatzschulen Land Schleswig-Holstein',
                faker.lorem.word(),
                faker.string.uuid(),
                OrganisationsTyp.SCHULE,
                undefined,
            );
            organisationEntity1 = em.create(OrganisationEntity, mapAggregateToData(root));
            organisationEntity2 = em.create(OrganisationEntity, mapAggregateToData(oeffentlich));
            organisationEntity3 = em.create(OrganisationEntity, mapAggregateToData(ersatz));
            await em.persistAndFlush([organisationEntity1, organisationEntity2, organisationEntity3]);
        });

        describe('When create is called', () => {
            it('should set oeffentlich as OrganisationsBaumZuordnung successfully', async () => {
                const schule: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    administriertVon: organisationEntity2.id,
                    typ: OrganisationsTyp.SCHULE,
                });
                const result: Organisation<true> = await sut.save(schule);

                expect(result).toBeInstanceOf(Organisation);
                expect(eventServiceMock.publish).toHaveBeenCalledWith(
                    expect.objectContaining({
                        organisationId: result.id,
                        kennung: result.kennung,
                        name: result.name,
                        rootDirectChildrenZuordnung: RootDirectChildrenType.OEFFENTLICH,
                    }),
                );
            });

            it('should set ersatz as OrganisationsBaumZuordnung successfully', async () => {
                const traeger: Organisation<true> = await sut.save(
                    DoFactory.createOrganisationAggregate(false, {
                        administriertVon: organisationEntity3.id,
                        typ: OrganisationsTyp.TRAEGER,
                    }),
                );
                const schule: Organisation<false> = DoFactory.createOrganisationAggregate(false, {
                    administriertVon: traeger.id,
                    typ: OrganisationsTyp.SCHULE,
                });
                const result: Organisation<true> = await sut.save(schule);

                expect(result).toBeInstanceOf(Organisation);
                expect(eventServiceMock.publish).toHaveBeenCalledWith(
                    expect.objectContaining({
                        organisationId: result.id,
                        kennung: result.kennung,
                        name: result.name,
                        rootDirectChildrenZuordnung: RootDirectChildrenType.ERSATZ,
                    }),
                );
            });

            it('should set oeffentlich as OrganisationsBaumZuordnung per default successfully', async () => {
                const result: Organisation<true> = await sut.save(
                    DoFactory.createOrganisationAggregate(false, {
                        administriertVon: undefined,
                        typ: OrganisationsTyp.SCHULE,
                    }),
                );

                expect(result).toBeInstanceOf(Organisation);
                expect(eventServiceMock.publish).toHaveBeenCalledWith(
                    expect.objectContaining({
                        organisationId: result.id,
                        kennung: result.kennung,
                        name: result.name,
                        rootDirectChildrenZuordnung: RootDirectChildrenType.OEFFENTLICH,
                    }),
                );
            });
        });
    });

    describe('isOrgaAParentOfOrgaB', () => {
        it('should return true if A is parent of B', async () => {
            const orgaA: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orgaA instanceof DomainError) {
                return;
            }
            const mappedOrgaA: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaA));
            await em.persistAndFlush(mappedOrgaA);
            const orgaB: Organisation<false> | DomainError = Organisation.createNew(
                mappedOrgaA.id,
                mappedOrgaA.id,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orgaB instanceof DomainError) {
                return;
            }
            const mappedOrgaB: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaB));
            await em.persistAndFlush(mappedOrgaB);

            await expect(sut.isOrgaAParentOfOrgaB(mappedOrgaA.id, mappedOrgaB.id)).resolves.toBe(true);
        });

        it('should return false if A is not parent of B', async () => {
            const orgaA: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orgaA instanceof DomainError) {
                return;
            }
            const mappedOrgaA: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaA));
            await em.persistAndFlush(mappedOrgaA);
            const orgaB: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
            );
            if (orgaB instanceof DomainError) {
                return;
            }
            const mappedOrgaB: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaB));
            await em.persistAndFlush(mappedOrgaB);

            await expect(sut.isOrgaAParentOfOrgaB(mappedOrgaA.id, mappedOrgaB.id)).resolves.toBe(false);
        });
    });

    describe('findAuthorized', () => {
        it('should return all organisations for root', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                {},
            );

            expect(result[1]).toBe(5);
        });

        it('should return no organisations if not authorized', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({ all: false, orgaIds: [] });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                {},
            );

            expect(result[1]).toBe(0);
        });

        it('should return all authorized organisations according to list', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[3]!.id, orgas[4]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                {},
            );

            expect(result[1]).toBe(3);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[3]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[4]!.id)).toBeTruthy();
        });

        it('should return all authorized organisations for searchString in name', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    'Test' + faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[2]!.id, orgas[4]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { searchString: 'Test' },
            );

            expect(result[1]).toBe(2);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[2]!.id)).toBeTruthy();
        });

        it('should return all authorized organisations for searchString in kennung', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    '1234567',
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[2]!.id, orgas[4]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { searchString: '23456' },
            );

            expect(result[1]).toBe(2);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[2]!.id)).toBeTruthy();
        });

        it('should return all authorized organisations with correct kennung and name', async () => {
            const orgas: OrganisationEntity[] = [];
            const orgaToFind: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                'dummy-kennung',
                'dummy-name',
            );
            if (orgaToFind instanceof DomainError) {
                return;
            }
            const mappedOrgaToFind: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaToFind));
            await em.persistAndFlush(mappedOrgaToFind);
            orgas.push(mappedOrgaToFind);

            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: true,
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { kennung: 'dummy-kennung', name: 'dummy-name' },
            );

            expect(result[1]).toBe(1);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
        });

        it('should return all authorized organisations with given ID even though other criteria are not met', async () => {
            const orgas: OrganisationEntity[] = [];
            const orgaToFind: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                'dummy-kennung',
                'dummy-name',
            );
            if (orgaToFind instanceof DomainError) {
                return;
            }
            const mappedOrgaToFind: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaToFind));
            await em.persistAndFlush(mappedOrgaToFind);
            orgas.push(mappedOrgaToFind);

            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: true,
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { kennung: 'dummy-kennung', name: 'dummy-name', organisationIds: [orgas[1]!.id] },
            );

            expect(result[1]).toBe(2);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[1]!.id)).toBeTruthy();
        });

        it('should not return Orgas for ID without permission', async () => {
            const orgas: OrganisationEntity[] = [];
            const orgaToFind: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                'dummy-kennung',
                'dummy-name',
            );
            if (orgaToFind instanceof DomainError) {
                return;
            }
            const mappedOrgaToFind: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaToFind));
            await em.persistAndFlush(mappedOrgaToFind);
            orgas.push(mappedOrgaToFind);

            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[1]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { kennung: 'dummy-kennung', name: 'dummy-name', organisationIds: [orgas[1]!.id, orgas[2]!.id] },
            );

            expect(result[1]).toBe(2);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[1]!.id)).toBeTruthy();
        });

        it('should merge results of organistations for IDs an other organisations correctly', async () => {
            const orgas: OrganisationEntity[] = [];

            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    'dummy-kennung',
                    'dummy-name',
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }

            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: true,
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                {
                    kennung: 'dummy-kennung',
                    name: 'dummy-name',
                    organisationIds: [orgas[1]!.id, orgas[7]!.id, orgas[8]!.id],
                    limit: 5,
                },
            );

            expect(result[1]).toBe(7);
            expect(result[0].length).toBe(5);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[1]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[7]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[8]!.id)).toBeTruthy();
        });

        it('should return all authorized organisations with correct type and parent', async () => {
            const orgas: OrganisationEntity[] = [];
            const orgaLand: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                '',
                'Öffentliche Schulen Land Schleswig-Holstein',
                undefined,
                undefined,
                OrganisationsTyp.LAND,
            );
            if (orgaLand instanceof DomainError) {
                return;
            }
            const mappedOrgaLand: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orgaLand));
            await em.persistAndFlush(mappedOrgaLand);
            orgas.push(mappedOrgaLand);

            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    mappedOrgaLand.id,
                    mappedOrgaLand.id,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.SCHULE,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Schule under Land');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    mappedOrgaLand.id,
                    mappedOrgaLand.id,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.TRAEGER,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Traeger');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.SCHULE,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Schule under root');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: true,
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { administriertVon: [mappedOrgaLand.id], typ: OrganisationsTyp.SCHULE },
            );

            expect(result[1]).toBe(3);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[1]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[2]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[3]!.id)).toBeTruthy();
        });

        it('should exclude type', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 2; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.SCHULE,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Schule under Land');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 2; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.TRAEGER,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Traeger');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 2; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                    undefined,
                    undefined,
                    OrganisationsTyp.KLASSE,
                );
                if (orga instanceof DomainError) {
                    fail('could not create Traeger');
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[2]!.id, orgas[3]!.id, orgas[4]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { excludeTyp: [OrganisationsTyp.KLASSE] },
            );

            expect(result[1]).toBe(3);
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[0]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[2]!.id)).toBeTruthy();
            expect(result[0].some((org: Organisation<true>) => org.id === orgas[3]!.id)).toBeTruthy();
        });

        it('should return correct pageTotal for root user without searchString', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 5; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({ all: true });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { limit: 3 }, // Simulate a limit for pagination
            );

            expect(result[1]).toBe(5); // total should be 5
            expect(result[2]).toBe(3); // pageTotal should be 3 because of the limit
        });

        it('should return correct pageTotal when searchString is used', async () => {
            const orgas: OrganisationEntity[] = [];
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    'Test' + faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            for (let i: number = 0; i < 3; i++) {
                const orga: Organisation<false> | DomainError = Organisation.createNew(
                    sut.ROOT_ORGANISATION_ID,
                    sut.ROOT_ORGANISATION_ID,
                    faker.string.numeric(6),
                    faker.company.name(),
                );
                if (orga instanceof DomainError) {
                    return;
                }
                const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
                await em.persistAndFlush(mappedOrga);
                orgas.push(mappedOrga);
            }
            const personPermissions: DeepMocked<PersonPermissions> = createMock<PersonPermissions>();
            personPermissions.getOrgIdsWithSystemrecht.mockResolvedValue({
                all: false,
                orgaIds: [orgas[0]!.id, orgas[2]!.id, orgas[4]!.id],
            });

            const result: [Organisation<true>[], number, number] = await sut.findAuthorized(
                personPermissions,
                [RollenSystemRecht.SCHULEN_VERWALTEN],
                { searchString: 'Test' },
            );

            expect(result[1]).toBe(2); // total matched organisations
            expect(result[2]).toBe(2); // pageTotal should also be 2 since it's less than the limit
        });
    });

    it('should only return organisations with the permitted IDs', async () => {
        const organisations: OrganisationEntity[] = [];

        // Create 5 organisations
        for (let i: number = 0; i < 5; i++) {
            const orga: Organisation<false> | DomainError = Organisation.createNew(
                sut.ROOT_ORGANISATION_ID,
                sut.ROOT_ORGANISATION_ID,
                faker.string.numeric(6),
                faker.company.name(),
                OrganisationsTyp.SCHULE,
            );
            if (orga instanceof DomainError) {
                fail('Could not create Organisation');
            }
            const mappedOrga: OrganisationEntity = em.create(OrganisationEntity, mapAggregateToData(orga));
            await em.persistAndFlush(mappedOrga);
            organisations.push(mappedOrga);
        }

        organisations.filter((orga: OrganisationEntity): orga is OrganisationEntity => orga !== undefined);

        // Only permit the first and third organisation
        const permittedOrgaIds: string[] = [organisations[0]?.id, organisations[2]?.id].filter(
            (id: string | undefined): id is string => !!id,
        );

        const finalOrgas: Organisation<true>[] = [];

        for (const orga of organisations) {
            const orgaAggregate: Organisation<true> = mapEntityToAggregate(orga);
            finalOrgas.push(orgaAggregate);
        }

        jest.spyOn(sut, 'findBy').mockResolvedValueOnce([
            finalOrgas.filter((orga: Organisation<true>) => permittedOrgaIds.includes(orga.id)),
            2,
        ]);

        if (permittedOrgaIds && permittedOrgaIds.length > 0) {
            // Call the method with permitted organisation IDs
            const result: Organisation<true>[] = await sut.findByNameOrKennungAndExcludeByOrganisationType(
                OrganisationsTyp.KLASSE, // Exclude some type, not relevant here
                undefined,
                permittedOrgaIds,
                25,
            );

            // Verify the result contains only the permitted organisations
            expect(result.length).toBe(2);
            expect(result.some((org: Organisation<true>) => org.id === organisations[0]?.id)).toBeTruthy();
            expect(result.some((org: Organisation<true>) => org.id === organisations[2]?.id)).toBeTruthy();
        }
    });
});
