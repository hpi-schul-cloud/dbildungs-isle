import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import { EnvConfig } from '../../shared/config/env.config.js';
import { defaultLoggerOptions } from './logger.module.js';


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
export class NestLoggerModule {}
