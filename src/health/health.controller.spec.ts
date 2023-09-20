import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import {
    HealthCheckService,
    HealthIndicatorFunction,
    HealthIndicatorResult,
    MikroOrmHealthIndicator,
} from '@nestjs/terminus';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { SqlEntityManager } from '@mikro-orm/postgresql';

describe('HealthController', () => {
    let controller: HealthController;

    let healthCheckService: DeepMocked<HealthCheckService>;
    let mikroOrmHealthIndicator: MikroOrmHealthIndicator;
    let entityManager: SqlEntityManager;
    beforeEach(async () => {
        healthCheckService = createMock<HealthCheckService>();
        mikroOrmHealthIndicator = createMock<MikroOrmHealthIndicator>();
        entityManager = createMock<SqlEntityManager>();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                { provide: HealthCheckService, useValue: healthCheckService },
                { provide: MikroOrmHealthIndicator, useValue: mikroOrmHealthIndicator },
                { provide: SqlEntityManager, useValue: entityManager },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should Perform all health checks', async () => {
        await controller.check();

        expect(healthCheckService.check).toHaveBeenCalled();
        const lastCallArgs: jest.ArgsType<HealthCheckService['check']> | undefined =
            healthCheckService.check.mock.lastCall;
        expect(lastCallArgs).toHaveLength(1);
        const indicators: HealthIndicatorFunction[] | undefined = lastCallArgs?.[0];
        expect(indicators).toHaveLength(1);
        const firstIndicator: (() => PromiseLike<HealthIndicatorResult> | HealthIndicatorResult) | undefined =
            indicators?.[0];
        expect(firstIndicator).not.toBeNull();
        await firstIndicator?.call(indicators?.[0]);

        expect(mikroOrmHealthIndicator.pingCheck).toHaveBeenCalled();
    });
});
