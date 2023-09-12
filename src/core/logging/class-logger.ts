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

    public warning(message: string, trace?: unknown): void {
        this.logger.warning(this.createMessage(message, trace));
    }

    public notice(message: string, trace?: unknown): void {
        this.logger.notice(this.createMessage(message, trace));
    }

    public info(message: string, trace?: unknown): void {
        this.logger.info(this.createMessage(message, trace));
    }

    public debug(message: string, trace?: unknown): void {
        this.logger.debug(this.createMessage(message, trace));
    }

    private createMessage(
        message: string,
        trace?: unknown,
    ): { message: string; context: string | undefined; trace?: unknown } {
        if (trace) {
            return { message, context: this.context, trace };
        }
        return { context: this.context, message };
    }
}
