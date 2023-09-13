import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { DbConsole } from './db.console.js';
import { ClassLogger } from '../core/logging/class-logger.js';

describe('DbConsole', () => {
    let module: TestingModule;
    let sut: DbConsole;

    const classLoggerMock: DeepMocked<ClassLogger> = createMock<ClassLogger>();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                DbConsole,
                {
                    provide: ClassLogger,
                    useValue: classLoggerMock,
                },
            ],
        }).compile();
        sut = module.get(DbConsole);
    });

    afterAll(async () => {
        await module.close();
    });

    describe('run', () => {
        describe('when running the db command', () => {
            it('should print reminder, that no sub command was provided', async () => {
                await expect(sut.run([])).resolves.not.toThrow();
                expect(classLoggerMock.info).toBeCalledWith('Did you forget the sub command?');
            });
        });
    });
});
