import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';

import { ClassLogger } from '../logging/class-logger.js';
import { LoggerModule } from '../logging/logger.module.js';
import { EventDiscoveryService } from './services/event-discovery.service.js';
import { EventService } from './services/event.service.js';

@Global()
@Module({
    imports: [LoggerModule.register(EventModule.name), DiscoveryModule],
    providers: [EventService, EventDiscoveryService],
    exports: [EventService],
})
export class EventModule implements OnApplicationBootstrap {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly discoveryService: EventDiscoveryService,
    ) {}

    public async onApplicationBootstrap(): Promise<void> {
        const handlerCount: number = await this.discoveryService.registerEventHandlers();
        this.logger.notice(`Registered ${handlerCount} event listeners`);
    }
}
