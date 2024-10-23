import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { Observable, of, throwError } from 'rxjs';
import { ConfigTestModule, DoFactory } from '../../../test/utils/index.js';
import { PersonenkontextService } from '../personenkontext/domain/personenkontext.service.js';
import { ServiceProvider } from '../service-provider/domain/service-provider.js';
import { ServiceProviderService } from '../service-provider/domain/service-provider.service.js';
import { OTPnotValidError } from './api/error/otp-not-valid.error.js';
import { SoftwareTokenVerificationError } from './api/error/software-token-verification.error.js';
import { TokenResetError } from './api/error/token-reset.error.js';
import { TokenError } from './api/error/token.error.js';
import { PrivacyIdeaAdministrationService } from './privacy-idea-administration.service.js';
import {
    AssignTokenResponse,
    PrivacyIdeaToken,
    ResetTokenPayload,
    ResetTokenResponse,
    TokenOTPSerialResponse,
    TokenVerificationResponse,
    User,
    VerificationResponse,
} from './privacy-idea-api.types.js';
import { LoggingTestModule } from '../../../test/utils/logging-test.module.js';

const mockErrorMsg: string = `Mock error`;

export const mockPrivacyIdeaToken: PrivacyIdeaToken = {
    active: true,
    count: 5,
    count_window: 10,
    description: 'Test token for mock data',
    failcount: 2,
    id: 12345,
    info: {
        hashlib: 'SHA-256',
        timeShift: '0',
        timeStep: '30',
        timeWindow: '5',
        tokenkind: 'software',
    },
    locked: false,
    maxfail: 3,
    otplen: 6,
    realms: ['exampleRealm'],
    resolver: 'exampleResolver',
    revoked: false,
    rollout_state: 'completed',
    serial: 'ABC123456',
    sync_window: 30,
    tokengroup: ['exampleGroup'],
    tokentype: 'TOTP',
    user_editable: true,
    user_id: 'user123',
    user_realm: 'userRealm',
    username: 'exampleUser',
};

export const mockUser: User = {
    description: 'Test user for mock data',
    editable: true,
    email: 'testuser@example.com',
    givenname: 'John',
    mobile: '+1234567890',
    phone: '+0987654321',
    resolver: 'exampleResolver',
    surname: 'Doe',
    userid: 'user123',
    username: 'johndoe',
};

export const mockVerificationResponseErrorCode905: VerificationResponse = {
    detail: null,
    id: 2,
    jsonrpc: '2.0',
    result: {
        status: false,
        error: {
            code: 905,
            message: 'Specific error message for code 905',
        },
    },
    time: 1627891255,
    version: '1.0',
    signature: 'hijklmn789012',
};

const mockJWTTokenResponse = (): Observable<AxiosResponse> =>
    of({ data: { result: { value: { token: `jwt-token` } } } } as AxiosResponse);

const mockEmptyUserResponse = (): Observable<AxiosResponse> => of({ data: { result: { value: [] } } } as AxiosResponse);

const mockUserResponse = (): Observable<AxiosResponse> =>
    of({ data: { result: { value: [mockUser] } } } as AxiosResponse);

const mockGoogleImageResponse = (): Observable<AxiosResponse> =>
    of({ data: { detail: { googleurl: { img: `base64img` } } } } as AxiosResponse);

export const mockVerificationError905Response = (): AxiosError<VerificationResponse> => {
    const error: AxiosError<VerificationResponse> = new AxiosError<VerificationResponse>(`Mock error`);
    error.response = { data: mockVerificationResponseErrorCode905 } as AxiosResponse;
    return error;
};

const mockEmptyPostResponse = (): Observable<AxiosResponse> => of({} as AxiosResponse);

const mockTokenResponse = (verify: boolean = false): Observable<AxiosResponse> => {
    if (verify) {
        const verifyToken: PrivacyIdeaToken = { ...mockPrivacyIdeaToken, rollout_state: 'verify' };
        return of({ data: { result: { value: { tokens: [verifyToken] } } } } as AxiosResponse);
    }
    return of({ data: { result: { value: { tokens: [mockPrivacyIdeaToken] } } } } as AxiosResponse);
};

export const mockVerficationTokenResponse = (status: boolean = true): Observable<AxiosResponse> =>
    of({ data: { result: { status: status } } } as AxiosResponse);

const mockErrorResponse = (): never => {
    throw new Error(mockErrorMsg);
};

const mockNonErrorThrow = (): never => {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw { message: mockErrorMsg };
};

const mockTokenVerificationResponse: TokenVerificationResponse = {
    result: {
        value: {
            count: 1,
            tokens: [
                {
                    username: '',
                    active: false,
                    count: 0,
                    count_window: 0,
                    description: '',
                    failcount: 0,
                    id: 0,
                    info: {
                        hashlib: '',
                        timeShift: '',
                        timeStep: '',
                        timeWindow: '',
                        tokenkind: '',
                    },
                    locked: false,
                    maxfail: 0,
                    otplen: 0,
                    realms: [],
                    resolver: '',
                    revoked: false,
                    rollout_state: '',
                    serial: '',
                    sync_window: 0,
                    tokengroup: [],
                    tokentype: '',
                    user_id: '',
                    user_realm: '',
                },
            ],
            current: 0,
            next: null,
            prev: null,
        },
        status: false,
    },
    id: 0,
    jsonrpc: '',
    time: 0,
    version: '',
    versionnumber: '',
    signature: '',
};

const mockTokenVerificationResponseNotFound: TokenVerificationResponse = {
    result: {
        value: {
            count: 0,
            tokens: [],
            current: 0,
            next: null,
            prev: null,
        },
        status: false,
    },
    id: 0,
    jsonrpc: '',
    time: 0,
    version: '',
    versionnumber: '',
    signature: '',
};

const mockTokenVerificationResponseAlreadyAssigned: TokenVerificationResponse = {
    result: {
        value: {
            count: 1,
            tokens: [
                {
                    username: 'user123',
                    active: false,
                    count: 0,
                    count_window: 0,
                    description: '',
                    failcount: 0,
                    id: 0,
                    info: {
                        hashlib: '',
                        timeShift: '',
                        timeStep: '',
                        timeWindow: '',
                        tokenkind: '',
                    },
                    locked: false,
                    maxfail: 0,
                    otplen: 0,
                    realms: [],
                    resolver: '',
                    revoked: false,
                    rollout_state: '',
                    serial: '',
                    sync_window: 0,
                    tokengroup: [],
                    tokentype: '',
                    user_id: '',
                    user_realm: '',
                },
            ],
            current: 0,
            next: null,
            prev: null,
        },
        status: false,
    },
    id: 0,
    jsonrpc: '',
    time: 0,
    version: '',
    versionnumber: '',
    signature: '',
};

const mockTokenOTPSerialResponse: TokenOTPSerialResponse = {
    result: {
        value: {
            serial: 'ABC123456',
            count: 0,
        },
        status: false,
    },
    id: 0,
    jsonrpc: '',
    time: 0,
    version: '',
    versionnumber: '',
    signature: '',
};

const mockTokenOTPSerialResponseInvalid: TokenOTPSerialResponse = {
    result: {
        value: {
            serial: 'INVALID',
            count: 0,
        },
        status: false,
    },
    id: 0,
    jsonrpc: '',
    time: 0,
    version: '',
    versionnumber: '',
    signature: '',
};

const mockAssignTokenResponse: AssignTokenResponse = {
    id: 1,
    jsonrpc: '2.0',
    result: {
        status: true,
        value: true,
    },
    time: 1234567890,
    version: 'v1',
    versionnumber: '1.0',
    signature: 'signature',
};

describe(`PrivacyIdeaAdministrationService`, () => {
    let service: PrivacyIdeaAdministrationService;
    let httpServiceMock: DeepMocked<HttpService>;
    let serviceProviderServiceMock: DeepMocked<ServiceProviderService>;
    let personenkontextServiceMock: DeepMocked<PersonenkontextService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [ConfigTestModule, LoggingTestModule],
            providers: [
                PrivacyIdeaAdministrationService,
                { provide: HttpService, useValue: createMock<HttpService>() },
                { provide: ServiceProviderService, useValue: createMock<ServiceProviderService>() },
                { provide: PersonenkontextService, useValue: createMock<PersonenkontextService>() },
            ],
        }).compile();

        service = module.get<PrivacyIdeaAdministrationService>(PrivacyIdeaAdministrationService);
        httpServiceMock = module.get(HttpService);
        serviceProviderServiceMock = module.get(ServiceProviderService);
        personenkontextServiceMock = module.get(PersonenkontextService);
    });

    describe(`initializeSoftwareToken`, () => {
        it(`should initialize a software token`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());
            httpServiceMock.post.mockReturnValueOnce(mockEmptyPostResponse());
            httpServiceMock.post.mockReturnValueOnce(mockGoogleImageResponse());

            const result: string = await service.initializeSoftwareToken(`test-user`, false);
            expect(result).toBe(`base64img`);
        });

        it(`should initialize a software token while deleting old verify token`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.delete.mockReturnValueOnce(of({} as AxiosResponse));
            httpServiceMock.post.mockReturnValueOnce(mockGoogleImageResponse());

            const result: string = await service.initializeSoftwareToken(`test-user`, false);
            expect(result).toBe(`base64img`);
        });

        it(`should throw an error if the jwt token request causes error throw`, async () => {
            httpServiceMock.post.mockImplementationOnce(mockErrorResponse);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error fetching JWT token: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the jwt token request causes throw`, async () => {
            httpServiceMock.post.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error fetching JWT token: Unknown error occurred`,
            );
        });

        it(`should throw an error if the check user exists request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockImplementationOnce(mockErrorResponse);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error checking user exists: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the check user exists request causes throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error checking user exists: Unknown error occurred`,
            );
        });

        it(`should throw an error if the add user request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());
            httpServiceMock.post.mockImplementationOnce(mockErrorResponse);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error adding user: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the add user exists request causes throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());
            httpServiceMock.post.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error adding user: Unknown error occurred`,
            );
        });

        it(`should throw an error if the jwt token request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.delete.mockImplementationOnce(mockErrorResponse);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error deleting token: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the jwt token request causes non error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.delete.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error deleting token: Unknown error occurred`,
            );
        });

        it(`should throw an error if the 2fa token request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());
            httpServiceMock.post.mockReturnValueOnce(mockEmptyPostResponse());
            httpServiceMock.post.mockImplementationOnce(mockErrorResponse);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error requesting 2fa token: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the 2fa token request causes throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());
            httpServiceMock.post.mockReturnValueOnce(mockEmptyPostResponse());
            httpServiceMock.post.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Error requesting 2fa token: Unknown error occurred`,
            );
        });

        it(`should throw an error if getJWTToken throws a non-Error object`, async () => {
            jest.spyOn(
                service as unknown as { getJWTToken: () => Promise<string> },
                'getJWTToken',
            ).mockImplementationOnce(() => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 'This is a non-Error throw';
            });

            await expect(service.initializeSoftwareToken(`test-user`, false)).rejects.toThrow(
                `Error initializing token: Unknown error occurred`,
            );
        });
    });

    describe(`getTwoAuthState`, () => {
        it(`should get the two auth state`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse());

            const result: PrivacyIdeaToken | undefined = await service.getTwoAuthState(`test-user`);
            expect(result).toBe(mockPrivacyIdeaToken);
        });

        it(`should return undefined user non existent`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockEmptyUserResponse());

            const result: PrivacyIdeaToken | undefined = await service.getTwoAuthState(`test-user`);
            expect(result).toBe(undefined);
        });

        it(`should throw an error if the user token request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockImplementationOnce(mockErrorResponse);

            await expect(service.getTwoAuthState(`test-user`)).rejects.toThrow(
                `Error getting two auth state: Error getting user tokens: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the user token request causes non error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.getTwoAuthState(`test-user`)).rejects.toThrow(
                `Error getting two auth state: Error getting user tokens: Unknown error occurred`,
            );
        });

        it(`should throw an error if the getUserTokens causes non error throw`, async () => {
            jest.spyOn(
                service as unknown as { getUserTokens: () => Promise<string> },
                'getUserTokens',
            ).mockImplementationOnce(() => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 'This is a non-Error throw';
            });

            await expect(service.getTwoAuthState(`test-user`)).rejects.toThrow(
                `Error getting two auth state: Unknown error occurred`,
            );
        });
    });

    describe('resetToken', () => {
        it('should reset token successfully', async () => {
            const mockResetUser: string = 'testUser';
            const mockJWTToken: string = 'mockJWTToken';
            const mockTwoAuthState: ResetTokenPayload = createMock<ResetTokenPayload>();
            const mockResetTokenResponse: ResetTokenResponse = createMock<ResetTokenResponse>();

            jest.spyOn(
                service as unknown as { getJWTToken: () => Promise<string> },
                'getJWTToken',
            ).mockResolvedValueOnce(mockJWTToken);
            jest.spyOn(
                service as unknown as { getTwoAuthState: (user: string) => Promise<ResetTokenPayload | null> },
                'getTwoAuthState',
            ).mockResolvedValueOnce(mockTwoAuthState);
            jest.spyOn(
                service as unknown as { unassignToken: (serial: string, token: string) => Promise<ResetTokenResponse> },
                'unassignToken',
            ).mockResolvedValueOnce(mockResetTokenResponse);

            const response: ResetTokenResponse = await service.resetToken(mockResetUser);
            expect(response).toEqual(mockResetTokenResponse);
            expect(service.getTwoAuthState).toHaveBeenCalledWith(mockResetUser);
            expect(service.unassignToken).toHaveBeenCalledWith(mockTwoAuthState.serial, mockJWTToken);
        });

        it('should throw an error if twoAuthState is not found', async () => {
            const mockResetUser: string = 'testUser';
            const mockJWTToken: string = 'mockJWTToken';

            jest.spyOn(
                service as unknown as { getJWTToken: () => Promise<string> },
                'getJWTToken',
            ).mockResolvedValueOnce(mockJWTToken);
            jest.spyOn(
                service as unknown as { getTwoAuthState: (user: string) => Promise<ResetTokenPayload | null> },
                'getTwoAuthState',
            ).mockResolvedValueOnce(null);

            await expect(service.resetToken(mockResetUser)).rejects.toThrow(new TokenResetError());
        });

        it('should throw an error if unassignToken fails', async () => {
            const mockResetUser: string = 'testUser';
            const mockJWTToken: string = 'mockJWTToken';
            const mockTwoAuthState: ResetTokenPayload = createMock<ResetTokenPayload>();

            jest.spyOn(
                service as unknown as { getJWTToken: () => Promise<string> },
                'getJWTToken',
            ).mockResolvedValueOnce(mockJWTToken);
            jest.spyOn(
                service as unknown as { getTwoAuthState: (user: string) => Promise<ResetTokenPayload | null> },
                'getTwoAuthState',
            ).mockResolvedValueOnce(mockTwoAuthState);
            jest.spyOn(service, 'unassignToken').mockRejectedValue(new Error('unassignToken error'));

            await expect(service.resetToken(mockResetUser)).rejects.toThrow(new TokenResetError());
        });
    });

    describe('unassignToken', () => {
        it('should unassign token successfully', async () => {
            const mockSerial: string = 'mockSerial';
            const mockToken: string = 'mockJWTToken';
            const mockResetTokenResponse: ResetTokenResponse = createMock<ResetTokenResponse>();
            const mockResetTokenResponsePromise: AxiosResponse<ResetTokenResponse> = {
                data: mockResetTokenResponse,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {
                    headers: new AxiosHeaders({ 'Content-Type': 'application/json' }),
                },
            };
            httpServiceMock.post.mockReturnValue(of(mockResetTokenResponsePromise));

            const response: ResetTokenResponse = await service.unassignToken(mockSerial, mockToken);
            expect(response).toEqual(mockResetTokenResponse);
        });

        it('should throw an error if unassignToken fails', async () => {
            const mockSerial: string = 'mockSerial';
            const mockToken: string = 'mockJWTToken';

            httpServiceMock.post.mockReturnValue(throwError(() => new Error('unassignToken error')));

            await expect(service.unassignToken(mockSerial, mockToken)).rejects.toThrow(
                'Error unassigning token: unassignToken error',
            );
        });

        it('should throw an error if unassignToken fails with non error throw', async () => {
            const mockSerial: string = 'mockSerial';
            const mockToken: string = 'mockJWTToken';

            httpServiceMock.post.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.unassignToken(mockSerial, mockToken)).rejects.toThrow(
                'Error unassigning token: Unknown error occurred',
            );
        });
    });

    describe('assignHardwareToken', () => {
        it('should assign hardware token successfully', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenVerificationResponse } as AxiosResponse));
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenOTPSerialResponse } as AxiosResponse));
            httpServiceMock.post.mockReturnValueOnce(of({ data: mockAssignTokenResponse } as AxiosResponse));
            const result: AssignTokenResponse = await service.assignHardwareToken('ABC123456', 'otp', 'test-user');
            expect(result).toEqual(mockAssignTokenResponse);
        });

        it('should assign hardware token successfully and create a new user', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(false);

            jest.spyOn(service as unknown as { addUser: () => Promise<void> }, 'addUser').mockResolvedValueOnce();
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenVerificationResponse } as AxiosResponse));
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenOTPSerialResponse } as AxiosResponse));
            httpServiceMock.post.mockReturnValueOnce(of({ data: mockAssignTokenResponse } as AxiosResponse));
            const result: AssignTokenResponse = await service.assignHardwareToken('ABC123456', 'otp', 'test-user');
            expect(result).toEqual(mockAssignTokenResponse);
        });

        it('should throw token-not-found error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(
                of({ data: mockTokenVerificationResponseNotFound } as AxiosResponse),
            );

            await expect(service.assignHardwareToken('INVALID_SERIAL', 'otp', 'test-user')).rejects.toThrow(
                new TokenError(
                    'Die eingegebene Seriennummer konnte leider nicht gefunden werden. Vergewissern Sie sich bitte, das Sie eine korrekte Seriennummer eingegeben haben.',
                    'token-not-found',
                ),
            );
        });

        it('should throw token-already-assigned error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(
                of({ data: mockTokenVerificationResponseAlreadyAssigned } as AxiosResponse),
            );

            await expect(service.assignHardwareToken('ABC123456', 'otp', 'test-user')).rejects.toThrow(
                new TokenError(
                    'Die eingegebene Seriennummer wird bereits aktiv verwendet. Bitte überprüfen Sie ihre Eingabe und versuchen Sie es erneut.',
                    'token-already-assigned',
                ),
            );
        });

        it('should throw token-otp-not-valid error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenVerificationResponse } as AxiosResponse));
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenOTPSerialResponseInvalid } as AxiosResponse));

            await expect(service.assignHardwareToken('ABC123456', 'invalid-otp', 'test-user')).rejects.toThrow(
                new TokenError('Ungültiger Code. Bitte versuchen Sie es erneut.', 'token-otp-not-valid'),
            );
        });

        it('should throw general-token-error on verifyTokenStatus error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockImplementationOnce(() => throwError(() => new Error(mockErrorMsg)));

            await expect(service.assignHardwareToken('ABC123456', 'otp', 'test-user')).rejects.toThrow(
                new TokenError(
                    'Leider konnte ihr Hardware-Token aus technischen Gründen nicht aktiviert werden. Bitte versuchen Sie es zu einem späteren Zeitpunkt erneut. Falls das Problem bestehen bleibt, stellen Sie bitte eine Anfrage über den IQSH Helpdesk.--Link: https://www.secure-lernnetz.de/helpdesk/',
                    'general-token-error',
                ),
            );
        });

        it('should throw general-token-error on getSerialWithOTP error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenVerificationResponse } as AxiosResponse));
            httpServiceMock.get.mockImplementationOnce(() => throwError(() => new Error(mockErrorMsg)));

            await expect(service.assignHardwareToken('ABC123456', 'otp', 'test-user')).rejects.toThrow(
                new TokenError(
                    'Leider konnte ihr Hardware-Token aus technischen Gründen nicht aktiviert werden. Bitte versuchen Sie es zu einem späteren Zeitpunkt erneut. Falls das Problem bestehen bleibt, stellen Sie bitte eine Anfrage über den IQSH Helpdesk.--Link: https://www.secure-lernnetz.de/helpdesk/',
                    'general-token-error',
                ),
            );
        });

        it('should throw general-token-error on assignToken error', async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            jest.spyOn(
                service as unknown as { checkUserExists: () => Promise<boolean> },
                'checkUserExists',
            ).mockResolvedValueOnce(true);
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenVerificationResponse } as AxiosResponse));
            httpServiceMock.get.mockReturnValueOnce(of({ data: mockTokenOTPSerialResponse } as AxiosResponse));
            httpServiceMock.post.mockImplementationOnce(() => throwError(() => new Error(mockErrorMsg)));

            await expect(service.assignHardwareToken('ABC123456', 'otp', 'test-user')).rejects.toThrow(
                new TokenError(
                    'Leider konnte ihr Hardware-Token aus technischen Gründen nicht aktiviert werden. Bitte versuchen Sie es zu einem späteren Zeitpunkt erneut. Falls das Problem bestehen bleibt, stellen Sie bitte eine Anfrage über den IQSH Helpdesk.--Link: https://www.secure-lernnetz.de/helpdesk/',
                    'general-token-error',
                ),
            );
        });
    });

    describe(`verifyToken`, () => {
        it(`should verify token`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockReturnValueOnce(mockVerficationTokenResponse());

            await service.verifyTokenEnrollment(`test-user`, `123456`);
        });

        it(`should throw domainerror when result status is false`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockReturnValueOnce(mockVerficationTokenResponse(false));

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow(
                SoftwareTokenVerificationError,
            );
        });

        it(`should throw domainerror with wrong otp`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockReturnValueOnce(throwError(() => mockVerificationError905Response()));

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow(OTPnotValidError);
        });

        it(`should throw error when axios error occurs`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockReturnValueOnce(throwError(() => new AxiosError('Mock error')));

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow(
                'Error verifying token: Mock error',
            );
        });

        it(`should throw an error if there is no token to verify`, async () => {
            jest.spyOn(
                service as unknown as { getTokenToVerify: () => Promise<PrivacyIdeaToken | undefined> },
                'getTokenToVerify',
            ).mockResolvedValueOnce(undefined);

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow('No token to verify');
        });

        it(`should throw an error if the verify request causes error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockImplementationOnce(mockErrorResponse);

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow(
                `Error verifying token: ${mockErrorMsg}`,
            );
        });

        it(`sshould throw an error if the tverify request causes non error throw`, async () => {
            httpServiceMock.post.mockReturnValueOnce(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValueOnce(mockUserResponse());
            httpServiceMock.get.mockReturnValueOnce(mockTokenResponse(true));
            httpServiceMock.post.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.verifyTokenEnrollment(`test-user`, `123456`)).rejects.toThrow(
                `Error verifying token: Unknown error occurred`,
            );
        });
    });

    describe('requires2fa', () => {
        const personId: string = faker.string.uuid();

        beforeEach(() => {
            personenkontextServiceMock.findPersonenkontexteByPersonId.mockResolvedValueOnce([
                DoFactory.createPersonenkontext(true),
            ]);
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it.each([true, false])('should return %s depending on 2fa requirement', async (requires2fa: boolean) => {
            const serviceProviders: Array<ServiceProvider<true>> = [
                DoFactory.createServiceProvider(true, { requires2fa }),
            ];
            serviceProviderServiceMock.getServiceProvidersByRolleIds.mockResolvedValueOnce(serviceProviders);

            const result: boolean = await service.requires2fa(personId);

            expect(result).toBe(requires2fa);
        });
    });

    describe('deleteUser', () => {
        const referrer: string = faker.string.alpha();

        it(`should delete user`, async () => {
            httpServiceMock.post.mockReturnValue(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValue(mockTokenResponse());
            httpServiceMock.delete.mockReturnValue(mockEmptyPostResponse());

            await expect(service.deleteUser(referrer)).resolves.toBeUndefined();
            expect(httpServiceMock.delete).toHaveBeenCalledTimes(1);
        });

        it(`should throw an error if the delete user causes error throw`, async () => {
            httpServiceMock.post.mockReturnValue(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValue(mockTokenResponse());
            httpServiceMock.delete.mockImplementationOnce(mockErrorResponse);

            await expect(service.deleteUser(referrer)).rejects.toThrow(
                `Error deleting privacyIDEA user: ${mockErrorMsg}`,
            );
        });

        it(`should throw an error if the delete user request causes non error throw`, async () => {
            httpServiceMock.post.mockReturnValue(mockJWTTokenResponse());
            httpServiceMock.get.mockReturnValue(mockTokenResponse());
            httpServiceMock.delete.mockImplementationOnce(mockNonErrorThrow);

            await expect(service.deleteUser(referrer)).rejects.toThrow(
                `Error deleting privacyIDEA user: Unknown error occurred`,
            );
        });
    });
});
