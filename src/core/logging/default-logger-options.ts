import { utilities } from 'nest-winston';
import { LoggerOptions } from 'winston';
import winston from 'winston';

export const defaultLoggerOptions: LoggerOptions = {
    levels: winston.config.syslog.levels,
    exitOnError: false,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        utilities.format.nestLike(),
    ),
    handleExceptions: true,
    handleRejections: true,
};
