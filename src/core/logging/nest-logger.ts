import { Injectable, LoggerService } from '@nestjs/common';
import util from 'util';
import { ModuleLogger } from './module-logger.js';

/**
 * Necessary for nest internal logging. Nest expects an implementation of LoggerService i.e. the method warn() instead of warning()
 */
@Injectable()
export class NestLogger implements LoggerService {
    public constructor(private moduleLogger: ModuleLogger) {}

    public log(message: unknown): void {
        this.moduleLogger.getLogger().info(this.stringifiedMessage(message));
    }

    public error(message: unknown): void {
        this.moduleLogger.getLogger().error(this.stringifiedMessage(message));
    }

    public warn(message: unknown): void {
        this.moduleLogger.getLogger().warning(this.stringifiedMessage(message));
    }

    public verbose?(message: unknown): void {
        this.moduleLogger.getLogger().info(this.stringifiedMessage(message));
    }

    public debug?(message: unknown): void {
        this.moduleLogger.getLogger().debug(this.stringifiedMessage(message));
    }

    private stringifiedMessage(message: unknown): string {
        const stringifiedMessage: string = util.inspect(message).replace(/\n/g, '').replace(/\\n/g, '');
        return stringifiedMessage;
    }
}
