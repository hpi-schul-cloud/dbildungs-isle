import { InjectionToken, Scope } from '@nestjs/common';
import winston, { Logger } from 'winston';
import { ModuleLogger } from './logger.js';
import { ConfigService } from '@nestjs/config';
import { defaultLoggerOptions } from './logger.module.js';
import { EnvConfig } from '../../shared/config/index.js';

type LoggerProvider = {
    provide: InjectionToken;
    inject: [InjectionToken];
    scope: Scope;
    useFactory: (configService: ConfigService<EnvConfig>) => ModuleLogger;
};

export const MODULE_LOGGER: string = 'MODULE_LOGGER';

export function moduleProviderFactory(moduleName: string): LoggerProvider {
    const logger: Logger = winston.createLogger({
        ...defaultLoggerOptions,
        transports: [new winston.transports.Console()], // transport needs to be newly created here to not share log level with other loggers
    });

    return {
        provide: MODULE_LOGGER,
        inject: [ConfigService],
        scope: Scope.TRANSIENT,
        useFactory: (configService: ConfigService<EnvConfig>): ModuleLogger => {
            let level: string | undefined = configService.get<string>(`${moduleName}.LOG_LEVEL`);
            if (!level) {
                level = configService.get<string>('NEST_LOG_LEVEL', 'info');
            }
            logger.level = level;

            return new ModuleLogger(logger, moduleName);
        },
    };
}
