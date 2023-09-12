import { ClassLogger } from './class-logger.js';
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleLogger } from './module-logger.js';
import { createMock } from '@golevelup/ts-jest';

describe('ClassLogger', () => {
    let loggerModule: TestingModule;

    let moduleLogger: ModuleLogger;
    beforeEach(async () => {
        moduleLogger = createMock<ModuleLogger>();
        loggerModule = await Test.createTestingModule({
            providers: [ClassLogger, { provide: ModuleLogger, useValue: moduleLogger }],
        }).compile();
    });

    it('should log appropriately for every level', async () => {
        const classLogger: ClassLogger = await loggerModule.resolve(ClassLogger);

        classLogger.debug('Blah');
        classLogger.notice('Blah');
        classLogger.info('Blah');
        classLogger.warning('Blah');
        classLogger.alert('Blah');
        classLogger.error('Blah');
        classLogger.crit('Blah');
        classLogger.emerg('Blah');
        expect(moduleLogger.getLogger().debug).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().info).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().warning).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().alert).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().error).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().crit).toHaveBeenCalledTimes(1);
        expect(moduleLogger.getLogger().emerg).toHaveBeenCalledTimes(1);
    });
    it('should take the trace into account', async () => {
        const classLogger: ClassLogger = await loggerModule.resolve(ClassLogger);

        classLogger.debug('Blah2', 'TraceInfo');
        expect(moduleLogger.getLogger().debug).toHaveBeenCalledTimes(1);
    });

    afterEach(async () => {
        await loggerModule.close();
    });
});
