import { Inject, Injectable, Scope } from '@nestjs/common';
import { ModuleLogger } from './module-logger.js';
import { Logger as LoggerWinston } from 'winston';
import { Logger } from './logger.js';
import { INQUIRER } from '@nestjs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class ClassLogger extends Logger {
    private logger: LoggerWinston;

    private context: string | undefined;

    public constructor(moduleLogger: ModuleLogger, @Inject(INQUIRER) private parentClass: object) {
        super();
        this.logger = moduleLogger.getLogger();
        this.context = `${moduleLogger.moduleName}.${this.parentClass?.constructor?.name}`;
    }

    public emerg(message: string, trace?: unknown): void {
        this.logger.emerg(this.createMessage(message, trace));
    }

    public alert(message: string, trace?: unknown): void {
        this.logger.alert(this.createMessage(message, trace));
    }

    public crit(message: string, trace?: unknown): void {
        this.logger.crit(this.createMessage(message, trace));
    }

    public error(message: string, trace?: unknown): void {
        this.logger.error(this.createMessage(message, trace));
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

    private createMessage(
        message: string,
        trace?: unknown,
    ): { message: string; context: string | undefined; trace: unknown } {
        return { message, context: this.context, trace };
    }
}
