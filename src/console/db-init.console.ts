import { MikroORM } from '@mikro-orm/core';
import { CommandRunner, SubCommand } from 'nest-commander';
import { ClassLogger } from '../core/logging/class-logger.js';

@SubCommand({ name: 'init', description: 'initializes the database' })
export class DbInitConsole extends CommandRunner {
    public constructor(
        private readonly orm: MikroORM,
        private readonly logger: ClassLogger,
    ) {
        super();
    }

    public override async run(_passedParams: string[], _options?: Record<string, unknown>): Promise<void> {
        this.logger.info('Initializing database...');
        this.logger.info(this.orm.config.getClientUrl());

        await this.orm.getSchemaGenerator().ensureDatabase();

        this.logger.info('Dropping Schema');
        await this.orm.getSchemaGenerator().dropSchema({ wrap: false });

        this.logger.info('Creating Schema');
        await this.orm.getSchemaGenerator().createSchema({ wrap: false });

        this.logger.info('Initialized database');
    }
}
