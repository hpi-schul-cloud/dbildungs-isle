import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { utilities, WinstonModule } from 'nest-winston';
import { LoggerOptions } from 'winston';
import winston from 'winston';
import { EnvConfig } from '../../shared/config/env.config.js';

// TODO make this a dynamic module to provide ModuleLogger and ClassLogger for other Modules

export const defaultLoggerOptions: LoggerOptions = {
    levels: winston.config.syslog.levels,
    exitOnError: false,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        utilities.format.nestLike(),
    ),
    handleExceptions: true,
    handleRejections: true,
};

@Module({
    imports: [
        WinstonModule.forRootAsync({
            useFactory: (configService: ConfigService<EnvConfig, true>) => {
                return {
                    ...defaultLoggerOptions,
                    level: configService.get<string>('NEST_LOG_LEVEL'),
                    transports: [new winston.transports.Console()],
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [],
    exports: [],
})
export class LoggerModule {}
