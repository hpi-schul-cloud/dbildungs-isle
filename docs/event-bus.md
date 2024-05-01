# EventModule

The [`EventModule`](/src/core/eventbus/event.module.ts) can be used to listen to and publish events across the whole application. This can be used for decoupling logic.

The event system stores a `RXJS.Subject` for every event that is subscribed to.
Every event handler is registered as an observer of that subject and when publishing an Event it is pushed into the correct subject.

A specific order of the event-handlers is not guaranteed and should not be relied upon.

## Publishing events

All events need to extend the [`BaseEvent`](/src/shared/events/base-event.ts). We place all events in [`/src/shared/events`](/src/shared/events).

BaseEvent uses a marker property to ensure, that object literals can never be given to the event-system. This is important, because the event-system assumes that events are always specific class instances and it uses the constructor to differentiate events.

```ts
export class UserCreationEvent extends BaseEvent {
    public constructor(public readonly userId: string) {
        super();
    }
}
```

Events can be published using the [`EventService`](/src/core/eventbus/services/event.service.ts). Simply inject it in your classes and publish new events.

```ts
@Controller({ path: '/user' })
export class UserController {
    public constructor(private readonly eventService: EventService) {}

    @Post()
    public createUser(@Body() user): void {
        this.eventService.publish(new UserCreationEvent(user.id));
    }
}
```

Publishing an event can never fail. If one or more of the registered observers throw an error, the error will be logged.

## Listening to events

In order to listen to events, you need to register you handlers with the event service.

Handlers have to be of type `(ev: MyEvent) => void | Promise<void>`.
Errors that are thrown inside of handler methods will be logged but won't crash the application.

You can register your handlers using the following methods:

### Using @EventHandler()

The [`@EventHandler(...)`](/src/core/eventbus/decorators/event-handler.decorator.ts)-Decorator can be used to decorate methods of providers or controllers. Event-handlers will be automatically discovered and registered by the [`EventDiscoveryService`](src/core/eventbus/services/event-discovery.service.ts).

Make sure to add the class to your module definition so it gets registered by NestJS.

```ts
@Injectable()
export class ExampleProvider {
    @EventHandler(UserCreationEvent)
    public syncEventHandler(event: UserCreationEvent): void {
        // Will be called for every published UserCreationEvent
    }

    @EventHandler(UserCreationEvent)
    public async asyncEventHandler(event: UserCreationEvent): Promise<void> {
        // Will be called for every published UserCreationEvent
    }
}
```

### Using the `.register`-method directly

You can also register event-handlers by using the `EventService.subscribe`-method. This approach is not recommended but may be useful in some niche situations.

```ts
@Injectable()
export class ExampleProvider {
    public constructor(eventService: EventService) {
        const handler = (ev: UserCreationEvent) => {
            // [...]
        };

        eventService.subscribe(UserCreationEvent, handler);

        // You can unregister events using 'unsubscribe'
        eventService.unsubscribe(UserCreationEvent, handler);
    }
}
```
