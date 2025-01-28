import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import express from 'express';
import { AccessApiKeyGuard } from './access.apikey.guard.js';

const canActivateSpy: jest.SpyInstance = jest.spyOn(AccessApiKeyGuard.prototype, 'canActivate');

describe('The access apikey guard', () => {
    let reflector: DeepMocked<Reflector>;
    let sut: AccessApiKeyGuard;

    beforeEach(() => {
        reflector = createMock<Reflector>();
        sut = new AccessApiKeyGuard(reflector);
    });

    it('should allow activation if request authenticated', () => {
        reflector.get.mockReturnValueOnce(false);

        const context: ExecutionContext = createMock();
        context.switchToHttp().getRequest<DeepMocked<express.Request>>().isAuthenticated.mockReturnValue(true);
        expect(sut.canActivate(context)).toEqual(true);
    });

    it('should delegate its activation if it cannot decide for itself', async () => {
        reflector.get.mockReturnValueOnce(false);

        const context: ExecutionContext = createMock();
        context.switchToHttp().getRequest<DeepMocked<express.Request>>().isAuthenticated.mockReturnValue(false);

        canActivateSpy.mockResolvedValueOnce(true);

        await sut.canActivate(context);

        expect(canActivateSpy).toHaveBeenCalled();
    });
});
