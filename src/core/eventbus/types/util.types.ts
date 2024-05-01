import { BaseEvent } from '../../../shared/events/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

export type MaybePromise<T> = T | Promise<T>;

export type EventHandlerType<Event extends BaseEvent> = (event: Event) => MaybePromise<void>;

export type TypedMethodDescriptor<T> = {
    value?: T;
};

export type TypedMethodDecorator<ParentClass, MethodName, MethodType> = (
    t: ParentClass,
    k: MethodName,
    d: TypedMethodDescriptor<MethodType>,
) => void;
