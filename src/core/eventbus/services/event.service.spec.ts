import { DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggingTestModule } from '../../../../test/utils/index.js';
import { BaseEvent } from '../../../shared/events/index.js';
import { ClassLogger } from '../../logging/class-logger.js';
import { EventHandlerType } from '../types/util.types.js';
import { EventService } from './event.service.js';

class TestEvent extends BaseEvent {
    public constructor() {
        super();
    }
}

function flushPromises(): Promise<void> {
    return new Promise((resolve: (value: void | PromiseLike<void>) => void) => setImmediate(resolve));
}

describe('EventService', () => {
    let module: TestingModule;

    let sut: EventService;

    let logger: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [LoggingTestModule],
            providers: [EventService],
        }).compile();

        sut = module.get(EventService);
        logger = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('subscribe', () => {
        it('should subscribe', () => {
            const handler: EventHandlerType<BaseEvent> = jest.fn();

            sut.subscribe(TestEvent, handler);

            sut.publish(new TestEvent());

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('unsubscribe', () => {
        it('should unsubscribe the handler', () => {
            const handler: jest.Mock = jest.fn();

            sut.subscribe(TestEvent, handler);
            sut.publish(new TestEvent());
            expect(handler).toHaveBeenCalled();
            handler.mockReset();

            sut.unsubscribe(TestEvent, handler);
            sut.publish(new TestEvent());
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('publish', () => {
        it('should call handler with event', () => {
            const handler: EventHandlerType<BaseEvent> = jest.fn();
            const event: TestEvent = new TestEvent();
            sut.subscribe(TestEvent, handler);

            sut.publish(event);

            expect(handler).toHaveBeenCalledWith(event);
        });

        it('should call multiple handlers', () => {
            const handler1: EventHandlerType<BaseEvent> = jest.fn();
            const handler2: EventHandlerType<BaseEvent> = jest.fn();
            const event: TestEvent = new TestEvent();

            sut.subscribe(TestEvent, handler1);
            sut.subscribe(TestEvent, handler2);

            sut.publish(event);

            expect(handler1).toHaveBeenCalledWith(event);
            expect(handler2).toHaveBeenCalledWith(event);
        });

        it('should work when no handler is registered', () => {
            const event: TestEvent = new TestEvent();

            expect(() => sut.publish(event)).not.toThrow();
        });

        it('should log errors with stack-trace in event handler', () => {
            const error: Error = new Error();
            const handler: jest.Mock = jest.fn(() => {
                throw error;
            });
            sut.subscribe(TestEvent, handler);

            sut.publish(new TestEvent());

            expect(logger.error).toHaveBeenCalledWith('Error in event handler', error.stack);
        });

        it('should log errors with stack-trace in async event handler', async () => {
            const error: Error = new Error();
            const handler: jest.Mock = jest.fn();
            handler.mockRejectedValueOnce(error);
            sut.subscribe(TestEvent, handler);

            sut.publish(new TestEvent());
            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith('Error in event handler', error.stack);
        });

        it('should log errors without stack-trace in event handler', async () => {
            const error: string = 'Not a real error';
            const handler: jest.Mock = jest.fn();
            handler.mockRejectedValueOnce(error);
            sut.subscribe(TestEvent, handler);

            sut.publish(new TestEvent());
            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith('Error in event handler', error);
        });
    });
});
