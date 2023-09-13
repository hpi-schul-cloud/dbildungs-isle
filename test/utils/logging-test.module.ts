import { createMock } from '@golevelup/ts-jest';
import { Global, Module } from '@nestjs/common';
import { LoggerModule } from '../../src/core/logging/logger.module.js';

@Global()
@Module({
    providers: [
        {
            provide: LoggerModule,
            useValue: createMock<LoggerModule>(),
        },
    ],
    exports: [LoggerModule],
})
export class LoggingTestModule {}
