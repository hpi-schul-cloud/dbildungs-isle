import winston, { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../shared/config/env.config.js';
import { Inject } from '@nestjs/common';
import { MODULE_NAME, defaultLoggerOptions } from './logger.module.js';

export class ModuleLogger {
    private logger: Logger;

    private moduleNameInternal: string;

    public constructor(@Inject(MODULE_NAME) moduleName: string, configService: ConfigService<EnvConfig>) {
        this.moduleNameInternal = moduleName;
        let level: Option<string> = configService.get<string>(`${moduleName}.LOG_LEVEL`);
        // TODO exchange this with correct config
        if (moduleName === 'PersonApiModule') {
            level = 'debug';
        }
        if (moduleName === 'PersonModule') {
            level = 'notice';
        }
        if (!level) {
            level = configService.get<string>('NEST_LOG_LEVEL', 'info');
        }
        this.logger = winston.createLogger({
            ...defaultLoggerOptions,
            level,
            transports: [new winston.transports.Console()], // transport needs to be newly created here to not share log level with other loggers
        });
    }

    public getLogger(): Logger {
        return this.logger;
    }

    public get moduleName(): string {
        return this.moduleNameInternal;
    }
}
