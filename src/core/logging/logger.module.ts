import { DynamicModule, Module } from '@nestjs/common';
import { ModuleLogger } from './module-logger.js';
import { ClassLogger } from './class-logger.js';
import { MODULE_NAME } from './module-name.symbol.js';
import { NestLogger } from './nest-logger.js';

@Module({
    imports: [],
    providers: [ModuleLogger, ClassLogger, NestLogger],
    exports: [ClassLogger],
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
            ],
            exports: [],
            global: false,
        };
    }
}
