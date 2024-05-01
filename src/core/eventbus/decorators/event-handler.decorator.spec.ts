/* eslint-disable max-classes-per-file */
import { BaseEvent } from '../../../shared/events/index.js';
import { EVENT_HANDLER_META } from '../types/metadata-key.js';
import { EventHandler } from './event-handler.decorator.js';

class TestEvent extends BaseEvent {
    public constructor() {
        super();
    }
}

class TestClass {
    @EventHandler(TestEvent)
    public handler(_ev: TestEvent): void {}

    // @ts-expect-error typechecker should detect invalid function signature
    @EventHandler(TestEvent)
    public invalidArgs(_ev: string): void {}

    // @ts-expect-error typechecker should detect invalid function signature
    @EventHandler(TestEvent)
    public invalidArgs2(_ev: TestEvent, _xyz: string): void {}
}

describe('EventHandler decorator', () => {
    it('should set metadata', () => {
        // eslint-disable-next-line jest/unbound-method
        const meta: unknown = Reflect.getMetadata(EVENT_HANDLER_META, TestClass.prototype.handler);

        expect(meta).toBe(TestEvent);
    });
});
