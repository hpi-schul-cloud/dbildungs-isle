import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';

import { LoginGuard } from './login.guard.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { KeycloakUserNotFoundError } from '../domain/keycloak-user-not-found.error.js';
import { HttpFoundException } from '../../../shared/error/http.found.exception.js';
import { AuthenticationErrorI18nTypes } from './dbiam-authentication.error.js';

const canActivateSpy: jest.SpyInstance = jest.spyOn(AuthGuard(['jwt', 'oidc']).prototype as IAuthGuard, 'canActivate');
const logInSpy: jest.SpyInstance = jest.spyOn(AuthGuard(['jwt', 'oidc']).prototype as IAuthGuard, 'logIn');

describe('LoginGuard', () => {
    let module: TestingModule;
    let sut: LoginGuard;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                LoginGuard,
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: ConfigService<ServerConfig>,
                    useValue: createMock<ConfigService<ServerConfig>>(),
                },
            ],
        }).compile();

        sut = module.get(LoginGuard);
    }, 30 * 1_000);

    afterAll(async () => {
        await module.close();
    }, 30 * 1_000);

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('canActivate', () => {
        it('should call canActivate of superclass', async () => {
            canActivateSpy.mockResolvedValueOnce(true);
            logInSpy.mockResolvedValueOnce(undefined);
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest<DeepMocked<Request>>().isAuthenticated.mockReturnValue(false);

            await sut.canActivate(contextMock);

            expect(canActivateSpy).toHaveBeenCalledWith(contextMock);
        });

        it('should short-circuit out when superclass canActivate fails', async () => {
            canActivateSpy.mockResolvedValueOnce(false);
            logInSpy.mockResolvedValueOnce(undefined);
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest<DeepMocked<Request>>().isAuthenticated.mockReturnValue(false);

            await expect(sut.canActivate(contextMock)).resolves.toBe(false);
        });

        it('should refuse on exception', async () => {
            canActivateSpy.mockResolvedValueOnce(true);
            logInSpy.mockRejectedValueOnce('Something broke');

            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest<DeepMocked<Request>>().isAuthenticated.mockReturnValue(false);

            await expect(sut.canActivate(contextMock)).resolves.toBe(false);
        });

        it('should call logIn of superclass', async () => {
            canActivateSpy.mockResolvedValueOnce(true);
            logInSpy.mockResolvedValueOnce(undefined);
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest<DeepMocked<Request>>().isAuthenticated.mockReturnValue(false);

            await sut.canActivate(contextMock);

            expect(logInSpy).toHaveBeenCalledWith(contextMock.switchToHttp().getRequest());
        });

        it('should save returnUrl to session if it exists', async () => {
            canActivateSpy.mockResolvedValueOnce(true);
            logInSpy.mockResolvedValueOnce(undefined);
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            const redirectUrl: string = faker.internet.url();
            contextMock.switchToHttp().getRequest<Request>().query = { redirectUrl };

            await sut.canActivate(contextMock);

            expect(contextMock.switchToHttp().getRequest<Request>().session.redirectUrl).toBe(redirectUrl);
        });

        it('should ignore errors in super.canActivate', async () => {
            canActivateSpy.mockRejectedValueOnce(new Error());
            logInSpy.mockResolvedValueOnce(undefined);
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest.mockReturnValue({
                query: {
                    requiredStepUpLevel: 'gold',
                },
                isAuthenticated: jest.fn().mockReturnValue(true),
                passportUser: {
                    access_token:
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY3IiOiJnb2xkIn0.3-QcljrIgxTpgaTgsTCpHtpr3wjsy5gnfwzghi-E_Ls',
                },
            });
            contextMock.switchToHttp().getResponse.mockReturnValue({});
            await expect(sut.canActivate(contextMock)).resolves.toBe(true);
        });

        it('should ignore errors in super.logIn', async () => {
            canActivateSpy.mockResolvedValueOnce(true);
            logInSpy.mockRejectedValueOnce(new Error());
            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest.mockReturnValue({
                query: {
                    requiredStepUpLevel: 'gold',
                },
                isAuthenticated: jest.fn().mockReturnValue(true),
                passportUser: {
                    access_token:
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY3IiOiJnb2xkIn0.3-QcljrIgxTpgaTgsTCpHtpr3wjsy5gnfwzghi-E_Ls',
                },
            });
            await expect(sut.canActivate(contextMock)).resolves.toBe(true);
        });

        it('should throw HttpFoundException exception if KeycloakUser does not exist', async () => {
            canActivateSpy.mockRejectedValueOnce(new KeycloakUserNotFoundError());
            logInSpy.mockResolvedValueOnce(undefined);

            const contextMock: DeepMocked<ExecutionContext> = createMock();
            contextMock.switchToHttp().getRequest<DeepMocked<Request>>().isAuthenticated.mockReturnValue(false);
            await expect(sut.canActivate(contextMock)).rejects.toThrow(
                new HttpFoundException({
                    DbiamAuthenticationError: {
                        code: 403,
                        i18nKey: AuthenticationErrorI18nTypes.KEYCLOAK_USER_NOT_FOUND,
                    },
                }),
            );
        });
    });
});
