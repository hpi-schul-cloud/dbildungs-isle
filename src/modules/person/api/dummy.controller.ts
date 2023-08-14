import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ModuleLogger } from '../../../core/logging/logger.js';
import { MODULE_LOGGER } from '../../../core/logging/module-logger-factory.js';

@ApiTags('dummy')
@Controller({ path: 'dummy' })
export class DummyController {
    public constructor(@Inject(MODULE_LOGGER) private logger: ModuleLogger) {
        this.logger.context = DummyController.name;
    }

    @Get()
    public getDummy(): void {
        this.logger.warning('asdfasdf');
    }
}
