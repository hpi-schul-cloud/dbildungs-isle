import { DynamicModule, Module } from '@nestjs/common';
import winston, { LoggerOptions } from 'winston';
import { ClassLogger } from './class-logger.js';
import { ModuleLogger } from './module-logger.js';

export const defaultLoggerOptions: LoggerOptions = {
    levels: winston.config.syslog.levels,
    exitOnError: false,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        winston.format.uncolorize(),
        winston.format.json(),
    ),
    handleExceptions: true,
    handleRejections: true,
};

export const MODULE_NAME: string = 'MODULE_NAME';

@Module({
    imports: [],
    providers: [],
    exports: [],
})
export class LoggerModule {
    public static register(moduleName: string): DynamicModule {
        return {
            module: LoggerModule,
            imports: [],
            providers: [
                {
                    provide: MODULE_NAME,
                    useValue: moduleName,
                },
                ModuleLogger,
                ClassLogger,
            ],
            exports: [ClassLogger],
            global: false,
        };
    }
}
