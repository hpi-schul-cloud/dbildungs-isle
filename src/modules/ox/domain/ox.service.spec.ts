import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { OxErrorType, OxService } from './ox.service.js';
import { OxBaseAction } from '../actions/ox-base-action.js';
import { OxError } from '../../../shared/error/ox.error.js';
import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { faker } from '@faker-js/faker';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { OxPrimaryMailNotEqualEmail1Error } from '../error/ox-primary-mail-not-equal-email1.error.js';

describe('OxService', () => {
    let module: TestingModule;
    let sut: OxService;

    let httpServiceMock: DeepMocked<HttpService>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule],
            providers: [
                OxService,
                {
                    provide: HttpService,
                    useValue: createMock<HttpService>(),
                },
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
            ],
        }).compile();

        sut = module.get(OxService);
        httpServiceMock = module.get(HttpService);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('send', () => {
        it('should call HttpService.post', async () => {
            const mockAction: DeepMocked<OxBaseAction<unknown, unknown>> = createMock<OxBaseAction<unknown, unknown>>();
            mockAction.buildRequest.mockReturnValueOnce({});
            mockAction.action = 'testAction';
            mockAction.soapServiceName = 'TestService';
            httpServiceMock.post.mockReturnValueOnce(of({} as AxiosResponse));

            await sut.send(mockAction);

            expect(httpServiceMock.post).toHaveBeenCalledWith(
                'https://ox_ip:ox_port/webservices/TestService',
                expect.stringContaining('username'),
                {
                    headers: {
                        'Content-Type': 'text/xml;charset=UTF-8',
                        SOAPAction: `"testAction"`,
                    },
                },
            );
        });

        it('should call parseResponse of action and return result', async () => {
            const mockAction: DeepMocked<OxBaseAction<unknown, string>> = createMock<OxBaseAction<unknown, string>>();
            mockAction.buildRequest.mockReturnValueOnce({});
            mockAction.parseResponse.mockReturnValueOnce({ ok: true, value: 'TestResult' });
            mockAction.action = 'testAction';
            mockAction.soapServiceName = 'TestService';

            httpServiceMock.post.mockReturnValueOnce(of({} as AxiosResponse));

            const result: Result<string, DomainError> = await sut.send(mockAction);

            expect(result).toEqual({
                ok: true,
                value: 'TestResult',
            });
        });

        it('should return OxError if request failed and response is NOT a specific OX-Error-response', async () => {
            const error: Error = new Error('AxiosError');
            const mockAction: DeepMocked<OxBaseAction<unknown, string>> = createMock<OxBaseAction<unknown, string>>();
            httpServiceMock.post.mockReturnValueOnce(throwError(() => error));

            const result: Result<string, DomainError> = await sut.send(mockAction);

            expect(result).toEqual({
                ok: false,
                error: new OxError('Request failed'),
            });
        });

        it('should return specific OxError and log error if request failed and response is a specific OX-Error-response', async () => {
            const faultString: string = 'primarymail must have the same value as email1; exceptionId 1826201806-2';
            const error: OxErrorType = {
                message: faker.string.alphanumeric(),
                code: faker.string.numeric(),
                response: {
                    status: 500,
                    statusText: 'statusText',
                    data:
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                        '<soap:Body>' +
                        '<soap:Fault>' +
                        '<faultcode>soap:Server</faultcode>' +
                        '<faultstring>' +
                        faultString +
                        '</faultstring>' +
                        '</soap:Fault>' +
                        '</soap:Body>' +
                        '</soap:Envelope>',
                },
            };

            const mockAction: DeepMocked<OxBaseAction<unknown, string>> = createMock<OxBaseAction<unknown, string>>();
            httpServiceMock.post.mockReturnValueOnce(throwError(() => error));

            const result: Result<string, DomainError> = await sut.send(mockAction);

            expect(loggerMock.error).toHaveBeenLastCalledWith('OX_PRIMARY_MAIL_NOT_EQUAL_EMAIL1_ERROR');
            expect(result).toEqual({
                ok: false,
                error: new OxPrimaryMailNotEqualEmail1Error(faultString),
            });
        });

        it('should return specific general OxError and log error if request failed and response could NOT be parsed', async () => {
            const faultyErrorWithMissingFaultString: OxErrorType = {
                message: faker.string.alphanumeric(),
                code: faker.string.numeric(),
                response: {
                    status: 500,
                    statusText: 'statusText',
                    data:
                        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                        '<soap:Body>' +
                        '<soap:Fault>' +
                        '<faultcode>soap:Server</faultcode>' +
                        '</soap:Fault>' +
                        '</soap:Body>' +
                        '</soap:Envelope>',
                },
            };

            const mockAction: DeepMocked<OxBaseAction<unknown, string>> = createMock<OxBaseAction<unknown, string>>();
            httpServiceMock.post.mockReturnValueOnce(throwError(() => faultyErrorWithMissingFaultString));

            const result: Result<string, DomainError> = await sut.send(mockAction);

            expect(loggerMock.error).toHaveBeenLastCalledWith(`OX-response could not be parsed, after error occurred`);
            expect(result).toEqual({
                ok: false,
                error: new OxError('OX-Response Could Not Be Parsed'),
            });
        });
    });
});
