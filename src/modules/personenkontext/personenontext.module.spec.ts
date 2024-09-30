import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, DatabaseTestModule, MapperTestModule } from '../../../test/utils/index.js';
import { PersonenKontextModule } from './personenkontext.module.js';
import { PersonenkontextRepo } from './persistence/personenkontext.repo.js';
import { PersonenkontextService } from './domain/personenkontext.service.js';

describe('PersonKontextModule', () => {
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot(), MapperTestModule, PersonenKontextModule],
        }).compile();
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('when module is initialized', () => {
        it('should resolve PersonenkontextRepo', () => {
            expect(module.get(PersonenkontextRepo)).toBeInstanceOf(PersonenkontextRepo);
        });

        it('should resolve PersonenkontextService', () => {
            expect(module.get(PersonenkontextService)).toBeInstanceOf(PersonenkontextService);
        });
    });
});
