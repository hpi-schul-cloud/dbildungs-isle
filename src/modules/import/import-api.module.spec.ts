import { TestingModule, Test } from '@nestjs/testing';
import { ConfigTestModule, DatabaseTestModule, MapperTestModule } from '../../../test/utils/index.js';
import { ImportWorkflowFactory } from './domain/import-workflow.factory.js';
import { ImportApiModule } from './import-api.module.js';
import { ImportController } from './api/import.controller.js';
import { MulterModule } from '@nestjs/platform-express';

describe('ImportApiModule', () => {
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot(), MapperTestModule, ImportApiModule],
        }).compile();
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('when module is initialized', () => {
        it('should resolve ImportWorkflowFactory', () => {
            expect(module.get(ImportWorkflowFactory)).toBeInstanceOf(ImportWorkflowFactory);
        });

        it('should resolve ImportController', () => {
            expect(module.get(ImportController)).toBeInstanceOf(ImportController);
        });

        it('should resolve MulterModule', () => {
            expect(module.get(MulterModule)).toBeInstanceOf(MulterModule);
        });
    });
});
