import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service.js';
import { ConsoleLoggerService } from './console-logger.service.js';

/**
 * @deprecated Use src/core/logging/logger.module.ts instead
 */
@Global()
@Module({
    providers: [
        {
            provide: LoggerService,
            useClass: ConsoleLoggerService,
        },
    ],
    exports: [LoggerService],
})
export class LoggingModule {}
