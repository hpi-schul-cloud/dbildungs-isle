import configEnv, { Config } from './config.env.js';

describe('Config Loader', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = {};
    });

    describe('System Config', () => {
        it('should load System configuration with parsed integer values', () => {
            process.env['SYSTEM_RENAME_WAITING_TIME_IN_SECONDS'] = '60';
            process.env['SYSTEM_STEP_UP_TIMEOUT_IN_SECONDS'] = '120';
            process.env['SYSTEM_STEP_UP_TIMEOUT_ENABLED'] = 'true';

            const config: Config = configEnv();
            expect(config.SYSTEM).toEqual({
                RENAME_WAITING_TIME_IN_SECONDS: 60,
                STEP_UP_TIMEOUT_IN_SECONDS: 120,
                STEP_UP_TIMEOUT_ENABLED: 'true',
            });
        });

        it('should set undefined for System values if not provided', () => {
            const config: Config = configEnv();
            expect(config.SYSTEM).toEqual({
                RENAME_WAITING_TIME_IN_SECONDS: undefined,
                STEP_UP_TIMEOUT_IN_SECONDS: undefined,
                STEP_UP_TIMEOUT_ENABLED: undefined,
            });
        });
    });

    describe('Import Config', () => {
        it('should load import configuration with parsed integer values', () => {
            process.env['IMPORT_CSV_FILE_MAX_SIZE_IN_MB'] = '10';
            process.env['IMPORT_CSV_MAX_NUMBER_OF_USERS'] = '2000';

            const config: Config = configEnv();
            expect(config.IMPORT).toEqual({
                CSV_FILE_MAX_SIZE_IN_MB: 10,
                CSV_MAX_NUMBER_OF_USERS: 2000,
            });
        });

        it('should set undefined for import values if not provided', () => {
            const config: Config = configEnv();
            expect(config.IMPORT).toEqual({
                CSV_FILE_MAX_SIZE_IN_MB: undefined,
                CSV_MAX_NUMBER_OF_USERS: undefined,
            });
        });

        it('should load import configuration with parsed not integer values', () => {
            process.env['CSV_FILE_MAX_SIZE_IN_MB'] = 'string';
            process.env['CSV_MAX_NUMBER_OF_USERS'] = 'string';

            const config: Config = configEnv();
            expect(config.IMPORT).toEqual({
                CSV_FILE_MAX_SIZE_IN_MB: undefined,
                CSV_MAX_NUMBER_OF_USERS: undefined,
            });
        });
    });
});
