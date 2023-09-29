import { Test, TestingModule } from '@nestjs/testing';
import { LoginService } from './login.service.js';
import { errors, Issuer, TokenSet } from 'openid-client';
import { createMock } from '@golevelup/ts-jest';
import { KeycloakClientError, UserAuthenticationFailedError } from '../../../shared/error/index.js';
import OPError = errors.OPError;

const issuerDiscoverMock: jest.Mock = jest.fn();
Issuer.discover = issuerDiscoverMock;

describe('LoginService', () => {
    let module: TestingModule;
    let loginService: LoginService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [LoginService],
        }).compile();
        loginService = module.get(LoginService);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(loginService).toBeDefined();
    });

    describe('should execute getTokenForUser', () => {
        it('expect success when Keycloak is mocked', () => {
            const expectedValue = Promise.resolve(createMock(TokenSet));
            issuerDiscoverMock.mockResolvedValueOnce(createMock(Issuer));
            expect(loginService.getTokenForUser('u', 'p')).toEqual(expectedValue);
            expect(issuerDiscoverMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('should fail during execute getTokenForUser', () => {
        it('expect KeycloakClientError', async () => {
            const expectedError: KeycloakClientError = new KeycloakClientError('KeyCloak service did not respond.');
            issuerDiscoverMock.mockRejectedValueOnce(expectedError);
            await expect(loginService.getTokenForUser('u', 'p')).rejects.toThrow(KeycloakClientError);
            expect(issuerDiscoverMock).toHaveBeenCalledTimes(1);
        });

        it('expect UserAuthenticationFailedError', async () => {
            const expectedError: OPError = new OPError({ error: 'invalid_grant' });
            issuerDiscoverMock.mockRejectedValueOnce(expectedError);
            await expect(loginService.getTokenForUser('u', 'p')).rejects.toThrow(UserAuthenticationFailedError);
            expect(issuerDiscoverMock).toHaveBeenCalledTimes(1);
        });
    });
});
