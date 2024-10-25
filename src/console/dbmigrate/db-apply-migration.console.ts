import { MikroORM, UmzugMigration } from '@mikro-orm/core';
import { CommandRunner, SubCommand, Option } from 'nest-commander';
import { Migrator } from '@mikro-orm/migrations';
import { ClassLogger } from '../../core/logging/class-logger.js';

export enum MigrationType {
    STRUCTURAL = 'structural',
    DATA = 'data',
    All = 'all',
}

@SubCommand({ name: 'migration-apply', description: 'applies latest migration version to database' })
export class DbApplyMigrationConsole extends CommandRunner {
    public constructor(
        private readonly orm: MikroORM,
        private readonly logger: ClassLogger,
    ) {
        super();
    }

    public override async run(_passedParams: string[], options?: Record<string, unknown>): Promise<void> {
        this.logger.info('Migrating to latest version...');
        const migrator: Migrator = this.orm.getMigrator();
        const migrationType: MigrationType = (options?.['migration'] as MigrationType) || MigrationType.All;

        const allMigrations: UmzugMigration[] = await migrator.getPendingMigrations();

        if (
            !allMigrations
                .map((migration: UmzugMigration) => migration.name)
                .every((name: string) => name.endsWith('S') || name.endsWith('D'))
        ) {
            throw new Error('Not all migrations end with a S or D');
        }

        const migrationsToExecute: UmzugMigration[] = allMigrations.filter((migration: UmzugMigration) => {
            if (migrationType === MigrationType.All) {
                return true;
            }

            if (migrationType === MigrationType.STRUCTURAL) {
                return migration.name.endsWith('S');
            }

            return migration.name.endsWith('D');
        });

        await migrator.up(migrationsToExecute.map((migration: UmzugMigration) => migration.name));
        this.logger.info('Finished migration to latest version.');
    }

    @Option({
        flags: '-m, --migration [migration]',
        description: 'The migrations to apply',
    })
    public parseMigrationOption(val: string): MigrationType {
        switch (val) {
            case 'structural':
                return MigrationType.STRUCTURAL;
            case 'data':
                return MigrationType.DATA;
            default:
                return MigrationType.All;
        }
    }
}
