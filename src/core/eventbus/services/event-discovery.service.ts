import { DiscoveredMethodWithMeta, DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';

import { BaseEvent } from '../../../shared/events/index.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { EVENT_HANDLER_META } from '../types/metadata-key.js';
import { Constructor, EventHandlerType } from '../types/util.types.js';
import { EventService } from './event.service.js';

type HandlerMethod = DiscoveredMethodWithMeta<Constructor<BaseEvent>>;

@Injectable()
export class EventDiscoveryService {
    public constructor(
        private readonly logger: ClassLogger,
        private readonly discoveryService: DiscoveryService,
        private readonly eventService: EventService,
    ) {}

    private async discoverHandlerMethods(): Promise<HandlerMethod[]> {
        const controllerMethods: HandlerMethod[] =
            await this.discoveryService.controllerMethodsWithMetaAtKey(EVENT_HANDLER_META);

        const providerMethods: HandlerMethod[] =
            await this.discoveryService.providerMethodsWithMetaAtKey(EVENT_HANDLER_META);

        return [...controllerMethods, ...providerMethods];
    }

    public async registerEventHandlers(): Promise<number> {
        const results: HandlerMethod[] = await this.discoverHandlerMethods();

        results.forEach((method: HandlerMethod) => {
            const eventConstructor: Constructor<BaseEvent> = method.meta;
            const eventHandler: EventHandlerType<BaseEvent> = method.discoveredMethod.handler;

            this.eventService.subscribe(method.meta, eventHandler);

            const parentClassName: string = method.discoveredMethod.parentClass.name;
            const handlerMethodName: string = method.discoveredMethod.methodName;

            this.logger.notice(
                `Registered handler '${parentClassName}.${handlerMethodName}' for '${eventConstructor.name}'`,
            );
        });

        return results.length;
    }
}
