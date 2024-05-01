declare const EVENT_MARKER: unique symbol;

export abstract class BaseEvent {
    // Is used to brand the class, this property will never exist on the created instances.
    // Ensures, that events have to always be derived from BaseEvent
    public readonly [EVENT_MARKER]!: never;
}
