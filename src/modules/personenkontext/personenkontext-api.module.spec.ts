import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DatabaseTestModule,
    MapperTestModule,
    KeycloakConfigTestModule,
} from '../../../test/utils/index.js';
import { PersonenKontextApiModule } from './personenkontext-api.module.js';
import { PersonenkontextController } from './api/personenkontext.controller.js';
import { PersonenkontextService } from './domain/personenkontext.service.js';
import { PersonenkontextRepo } from './persistence/personenkontext.repo.js';
import { RolleRepo } from '../rolle/repo/rolle.repo.js';
import { createMock } from '@golevelup/ts-jest';
import { DBiamPersonenkontextRepo } from './persistence/dbiam-personenkontext.repo.js';

describe('PersonenKontextApiModule', () => {
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
            ],
            imports: [
                ConfigTestModule,
                DatabaseTestModule.forRoot(),
                MapperTestModule,
                PersonenKontextApiModule,
                KeycloakConfigTestModule.forRoot(),
            ],
        }).compile();
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('when module is initialized', () => {
        it('should resolve PersonkontextController', () => {
            expect(module.get(PersonenkontextController)).toBeInstanceOf(PersonenkontextController);
        });

        it('should resolve PersonenkontextService', () => {
            expect(module.get(PersonenkontextService)).toBeInstanceOf(PersonenkontextService);
        });

        it('should resolve PersonenkontextRepo', () => {
            expect(module.get(PersonenkontextRepo)).toBeInstanceOf(PersonenkontextRepo);
        });
    });
});
