import { ExecutionContext } from '@nestjs/common';
import { MetricsGuard } from './metrics.guard.js';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { MetricsConfig } from '../../shared/config/metrics.config.js';
import { createMock } from '@golevelup/ts-jest';

describe('MetricsGuard - Basic Auth', () => {
    let metricsGuard: MetricsGuard;
    let mockContext: jest.Mocked<ExecutionContext>;
    let configService: jest.Mocked<ConfigService>;

    beforeEach(() => {
        configService = createMock<ConfigService>();
        configService.getOrThrow.mockImplementation((key: keyof MetricsConfig) => {
            if (key === ('METRICS' as keyof MetricsConfig)) {
                return {
                    USERNAME: 'admin',
                    PASSWORD: 'admin',
                };
            }
            throw new Error(`Unexpected config key: ${key}`);
        });
        metricsGuard = new MetricsGuard(configService);

        mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn(),
            }),
        } as unknown as jest.Mocked<ExecutionContext>;
    });

    it('should return false if authorization header is missing', () => {
        const mockRequest: Partial<Request> = { headers: {} };
        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest as Request);

        const result: boolean = metricsGuard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should return false if authorization header does not start with "Basic "', () => {
        const mockRequest: Partial<Request> = { headers: { authorization: 'Bearer token' } };
        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest as Request);

        const result: boolean = metricsGuard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should return false if Basic auth credentials are malformed (missing Base64)', () => {
        const mockRequest: Partial<Request> = { headers: { authorization: 'Basic invalidBase64' } };
        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest as Request);

        const result: boolean = metricsGuard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should return false if Basic auth credentials are incomplete (no colon)', () => {
        const invalidCredentials: string = Buffer.from('admin').toString('base64');
        const mockRequest: Partial<Request> = { headers: { authorization: `Basic ${invalidCredentials}` } };
        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest as Request);

        const result: boolean = metricsGuard.canActivate(mockContext);

        expect(result).toBe(false);
    });

    it('should return true for valid Basic auth credentials', () => {
        const validCredentials: string = Buffer.from('admin:admin').toString('base64');
        const mockRequest: Partial<Request> = { headers: { authorization: `Basic ${validCredentials}` } };
        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest as Request);

        const result: boolean = metricsGuard.canActivate(mockContext);

        expect(result).toBe(true);
    });
});
