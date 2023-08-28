export abstract class Logger {
    public abstract error(message: string, trace?: unknown): void;

    public abstract warning(message: string): void;

    public abstract notice(message: string): void;

    public abstract info(message: string): void;

    public abstract debug(message: string): void;
}
