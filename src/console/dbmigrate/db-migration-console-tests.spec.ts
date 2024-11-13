import { MikroORM, UmzugMigration } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DatabaseTestModule,
    LoggingTestModule,
} from '../../../test/utils/index.js';
import fs from 'fs';
import { DbInitMigrationConsole } from './db-init-migration.console.js';
import { DbApplyMigrationConsole, MigrationType } from './db-apply-migration.console.js';
import { DbCreateMigrationConsole } from './db-create-migration.console.js';
import { Migrator } from '@mikro-orm/migrations';

describe('DbMigrateConsole', () => {
    let module: TestingModule;
    let dbMigrationInit: DbInitMigrationConsole;
    let dbMigrationCreate: DbCreateMigrationConsole;
    let dbMigrationApply: DbApplyMigrationConsole;
    let orm: MikroORM;
    let migrator: Migrator;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), LoggingTestModule],
            providers: [DbInitMigrationConsole, DbCreateMigrationConsole, DbApplyMigrationConsole],
        }).compile();
        dbMigrationInit = module.get(DbInitMigrationConsole);
        dbMigrationCreate = module.get(DbCreateMigrationConsole);
        dbMigrationApply = module.get(DbApplyMigrationConsole);
        orm = module.get(MikroORM);
        migrator = orm.getMigrator();

        fs.rmSync('test-migrations', { recursive: true, force: true });
    }, 2 * DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    it('should be defined', () => {
        expect(dbMigrationInit).toBeDefined();
        expect(dbMigrationCreate).toBeDefined();
        expect(dbMigrationApply).toBeDefined();
    });

    describe('run', () => {
        describe('when migration-init is executed', () => {
            it('should not throw an error', async () => {
                await expect(dbMigrationInit.run([])).resolves.not.toThrow();
            });
        });

        describe('when migration-create is executed', () => {
            it('should not throw an error', async () => {
                await expect(dbMigrationCreate.run([])).resolves.not.toThrow();
            });
        });

        describe('when migration-apply is executed', () => {
            it('should not throw an error', async () => {
                jest.spyOn(migrator, 'getPendingMigrations').mockReturnValueOnce(Promise.resolve([]));
                await expect(dbMigrationApply.run([])).resolves.not.toThrow();
            });
        });
    });

    describe('DbApplyMigrationConsole', () => {
        beforeEach(() => {
            jest.spyOn(migrator, 'up').mockResolvedValueOnce(Promise.resolve([]));
        });

        it('should apply all pending migrations', async () => {
            const migrations: UmzugMigration[] = [{ name: '20210101_initialS' }, { name: '20210202_dataD' }];
            jest.spyOn(migrator, 'getPendingMigrations').mockReturnValueOnce(Promise.resolve(migrations));
            await dbMigrationApply.run([]);
            expect(migrator.up).toHaveBeenCalledWith(migrations.map((m: UmzugMigration) => m.name));
        });

        it('should filter and apply only structural migrations', async () => {
            const migrations: UmzugMigration[] = [{ name: '20210101_initialS' }, { name: '20210202_dataD' }];
            jest.spyOn(migrator, 'getPendingMigrations').mockReturnValueOnce(Promise.resolve(migrations));
            await dbMigrationApply.run([], { migration: 'structural' });
            expect(migrator.up).toHaveBeenCalledWith(['20210101_initialS']);
        });

        it('should filter and apply only data migrations', async () => {
            const migrations: UmzugMigration[] = [{ name: '20210101_initialS' }, { name: '20210202_dataD' }];
            jest.spyOn(migrator, 'getPendingMigrations').mockReturnValueOnce(Promise.resolve(migrations));
            await dbMigrationApply.run([], { migration: 'data' });
            expect(migrator.up).toHaveBeenCalledWith(['20210202_dataD']);
        });

        it('should throw an error if any migration does not end with S or D', async () => {
            const migrations: UmzugMigration[] = [{ name: '20210101_initial' }];
            jest.spyOn(migrator, 'getPendingMigrations').mockReturnValueOnce(Promise.resolve(migrations));
            await expect(dbMigrationApply.run([])).rejects.toThrow('Not all migrations end with a S or D');
        });
    });

    describe('parseMigrationOption', () => {
        it('should return STRUCTURAL for "structural"', () => {
            expect(dbMigrationApply.parseMigrationOption('structural')).toBe(MigrationType.STRUCTURAL);
        });

        it('should return DATA for "data"', () => {
            expect(dbMigrationApply.parseMigrationOption('data')).toBe(MigrationType.DATA);
        });

        it('should return All for any other value', () => {
            expect(dbMigrationApply.parseMigrationOption('anything')).toBe(MigrationType.All);
        });
    });
});
