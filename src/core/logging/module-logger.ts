import winston, { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { defaultLoggerOptions } from './logger.module.js';
import { EnvConfig } from '../../shared/config/env.config.js';

export class ModuleLogger {
    private logger: Logger;

    public constructor(moduleName: string, configService: ConfigService<EnvConfig>) {
        let level: string | undefined = configService.get<string>(`${moduleName}.LOG_LEVEL`);
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
}
