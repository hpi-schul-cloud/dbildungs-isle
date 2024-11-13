import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM, RequiredEntityData } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DoFactory,
} from '../../../../test/utils/index.js';
import { ImportDataRepository, mapAggregateToData, mapEntityToAggregate } from './import-data.repository.js';
import { ImportDataItem } from '../domain/import-data-item.js';
import { ImportDataItemEntity } from './import-data-item.entity.js';

describe('ImportDataRepository', () => {
    let module: TestingModule;
    let sut: ImportDataRepository;
    let orm: MikroORM;
    let em: EntityManager;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true })],
            providers: [ImportDataRepository],
        }).compile();
        sut = module.get(ImportDataRepository);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);

        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('mapAggregateToData', () => {
        it('should return ImportDataItem RequiredEntityData', () => {
            const importDataItem: ImportDataItem<true> = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.string.uuid(),
                faker.name.lastName(),
                faker.name.firstName(),
                faker.lorem.word(),
                undefined,
            );

            const expectedProperties: string[] = ['importvorgangId', 'nachname', 'vorname', 'klasse', 'personalnummer'];

            const result: RequiredEntityData<ImportDataItemEntity> = mapAggregateToData(importDataItem);

            expectedProperties.forEach((prop: string) => {
                expect(result).toHaveProperty(prop);
            });
        });
    });

    describe('mapEntityToAggregate', () => {
        it('should return New Aggregate', () => {
            const entiity: ImportDataItemEntity = em.create(
                ImportDataItemEntity,
                mapAggregateToData(DoFactory.createImportDataItem(true)),
            );
            const importDataItem: ImportDataItem<true> = mapEntityToAggregate(entiity);

            expect(importDataItem).toBeInstanceOf(ImportDataItem);
        });
    });

    describe('findByImportVorgangId', () => {
        let importDataItem1: ImportDataItem<false>;
        let importDataItem2: ImportDataItem<false>;
        let importDataItem3: ImportDataItem<false>;
        let entity1: ImportDataItemEntity;
        let entity2: ImportDataItemEntity;
        let entity3: ImportDataItemEntity;

        const importVorgnagsId: string = faker.string.uuid();

        beforeEach(async () => {
            importDataItem1 = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                importVorgnagsId,
                faker.name.lastName(),
                faker.name.firstName(),
                '1A',
                undefined,
            );
            importDataItem2 = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                importVorgnagsId,
                faker.name.lastName(),
                faker.name.firstName(),
                '1B',
                undefined,
            );
            importDataItem3 = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.string.uuid(),
                faker.name.lastName(),
                faker.name.firstName(),
                '1C',
                undefined,
            );
            entity1 = em.create(ImportDataItemEntity, mapAggregateToData(importDataItem1));
            entity2 = em.create(ImportDataItemEntity, mapAggregateToData(importDataItem2));
            entity3 = em.create(ImportDataItemEntity, mapAggregateToData(importDataItem3));
            await em.persistAndFlush([entity1, entity2, entity3]);
        });

        afterEach(async () => {
            await em.removeAndFlush([entity1, entity2, entity3]);
        });

        it('should return importDataItems for the importVorgnagsId', async () => {
            const [result, total]: [Option<ImportDataItem<true>[]>, number] = await sut.findByImportVorgangId(
                importVorgnagsId,
                0,
                30,
            );

            expect(result?.length).toBe(2);
            expect(total).toBe(2);
        });
    });

    describe('save', () => {
        it('should save a new importDataItem', async () => {
            const importDataItem: ImportDataItem<false> = DoFactory.createImportDataItem(false);

            const savedImportDataItem: ImportDataItem<true> = await sut.save(importDataItem);

            expect(savedImportDataItem.id).toBeDefined();
        });
    });

    describe('deleteByImportVorgangId', () => {
        let importDataItem1: ImportDataItem<false>;
        let importDataItem2: ImportDataItem<false>;
        let entity1: ImportDataItemEntity;
        let entity2: ImportDataItemEntity;

        const importVorgnagsId: string = faker.string.uuid();

        beforeEach(async () => {
            importDataItem1 = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                importVorgnagsId,
                faker.name.lastName(),
                faker.name.firstName(),
                '1A',
                undefined,
            );
            importDataItem2 = ImportDataItem.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                importVorgnagsId,
                faker.name.lastName(),
                faker.name.firstName(),
                '1B',
                undefined,
            );
            entity1 = em.create(ImportDataItemEntity, mapAggregateToData(importDataItem1));
            entity2 = em.create(ImportDataItemEntity, mapAggregateToData(importDataItem2));
            await em.persistAndFlush([entity1, entity2]);
        });

        it('should delete all the import data items for the importVorgnagsId', async () => {
            const result: void = await sut.deleteByImportVorgangId(importVorgnagsId);
            const [findResult, findTotal]: [Option<ImportDataItem<true>[]>, number] =
                await sut.findByImportVorgangId(importVorgnagsId);

            expect(result).toBeUndefined();
            expect(findResult.length).toBe(0);
            expect(findTotal).toBe(0);
        });
    });
});
