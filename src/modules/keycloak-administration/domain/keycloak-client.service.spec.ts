import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakAdminClient } from '@s3pweb/keycloak-admin-client-cjs';

import { ConfigTestModule, KeycloakConfigTestModule, LoggingTestModule } from '../../../../test/utils/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { KeycloakClientError } from '../../../shared/error/keycloak-client.error.js';
import { KC_SERVICE_CLIENT } from '../keycloak-client-providers.js';
import { KeycloakClientService } from './keycloak-client.service.js';

describe('KeycloakClientService', () => {
    let module: TestingModule;
    let sut: KeycloakClientService;

    let kcClientsMock: DeepMocked<KeycloakAdminClient['clients']>;
    let loggerMock: DeepMocked<ClassLogger>;

    beforeAll(async () => {
        kcClientsMock = createMock<KeycloakAdminClient['clients']>();

        module = await Test.createTestingModule({
            imports: [ConfigTestModule, LoggingTestModule, KeycloakConfigTestModule.forRoot()],
            providers: [
                KeycloakClientService,
                {
                    provide: KC_SERVICE_CLIENT,
                    useValue: createMock<KeycloakAdminClient>({ clients: kcClientsMock }),
                },
            ],
        }).compile();

        sut = module.get(KeycloakClientService);
        loggerMock = module.get(ClassLogger);
    });

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('updateClient', () => {
        it('should call update on the keycloak client', async () => {
            const clientId: string = faker.string.uuid();

            const result: Result<undefined, DomainError> = await sut.updateClient(clientId, {});

            expect(kcClientsMock.update).toHaveBeenCalledWith({ id: clientId }, {});
            expect(result.ok).toBe(true);
        });

        it('should log errors and return them', async () => {
            const clientId: string = faker.string.uuid();
            const error: Error = new Error('Test Error');
            kcClientsMock.update.mockRejectedValueOnce(error);

            const result: Result<undefined, DomainError> = await sut.updateClient(clientId, {});

            expect(loggerMock.error).toHaveBeenCalledWith(`Could not update client with ID ${clientId}`, error);
            expect(result).toEqual({
                ok: false,
                error: new KeycloakClientError('Could not update client'),
            });
        });
    });
});
