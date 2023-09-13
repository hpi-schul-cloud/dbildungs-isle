import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigTestModule, DatabaseTestModule, LoggingTestModule } from '../../test/utils/index.js';
import { DbInitConsole } from './db-init.console.js';
import { ConfigService } from '@nestjs/config';
import { DbConfig, ServerConfig } from '../shared/config/index.js';
import { ClassLogger } from '../core/logging/class-logger.js';
import { createMock } from '@golevelup/ts-jest';

describe('DbInitConsole', () => {
    let module: TestingModule;
    let sut: DbInitConsole;
    let orm: MikroORM;
    let configService: ConfigService<ServerConfig, true>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), LoggingTestModule],
            providers: [
                DbInitConsole,
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
            ],
        }).compile();
        sut = module.get(DbInitConsole);
        orm = module.get(MikroORM);
        configService = module.get(ConfigService);
    }, 30 * 1_000);

    afterAll(async () => {
        await module.close();
    }, 30 * 1_000);

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('run', () => {
        describe('when database is available', () => {
            it('should initialize database with schema', async () => {
                await expect(sut.run([])).resolves.not.toThrow();
            });
        });

        describe('when database is not available', () => {
            beforeAll(async () => {
                if (await orm.getSchemaGenerator().ensureDatabase())
                    await orm.getSchemaGenerator().dropDatabase(configService.getOrThrow<DbConfig>('DB').DB_NAME);
            });

            it('should create and initialize database with schema', async () => {
                await expect(sut.run([])).resolves.not.toThrow();
            });
        });
    });
});
