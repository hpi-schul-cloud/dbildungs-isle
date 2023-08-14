import { Logger } from 'winston';

export class ModuleLogger {
    private contextInternal: string | undefined;

    public constructor(private readonly logger: Logger, private moduleContext?: string) {
        this.contextInternal = moduleContext;
    }

    // TODO how handle stack traces and formatting
    public error(message: string, trace?: unknown): void {
        // eslint-disable-next-line @typescript-eslint/typedef
        const result = {
            ...this.createMessage(message),
            trace,
        };
        this.logger.error(result);
    }

    public warning(message: string): void {
        this.logger.warning(this.createMessage(message));
    }

    public notice(message: string): void {
        this.logger.notice(this.createMessage(message));
    }

    public info(message: string): void {
        this.logger.info(this.createMessage(message));
    }

    public debug(message: string): void {
        this.logger.debug(this.createMessage(message));
    }

    public set context(context: string) {
        this.contextInternal = this.moduleContext ? `${this.moduleContext}.${context}` : context;
    }

    private createMessage(message: string): { message: string; context: string | undefined } {
        return { message, context: this.contextInternal };
    }
}
