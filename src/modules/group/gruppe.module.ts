import { Module } from '@nestjs/common';
import { GruppenController } from './api/gruppe.controller.js';
import { GruppenFactory } from './domain/gruppe.factory.js';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { GruppenRepository } from './domain/gruppe.repo.js';
import { GruppeMapper } from './domain/gruppe.mapper.js';

@Module({
    imports: [LoggerModule.register(GruppenModule.name)],
    providers: [GruppenFactory, GruppenRepository, GruppeMapper],
    controllers: [GruppenController],
})
export class GruppenModule {}
