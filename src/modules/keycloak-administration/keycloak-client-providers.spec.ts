import { Test, TestingModule } from '@nestjs/testing';
import { KeycloakAdminClient } from '@s3pweb/keycloak-admin-client-cjs';

import { ConfigTestModule, KeycloakConfigTestModule } from '../../../test/utils/index.js';
import { KC_SERVICE_CLIENT, KeycloakServiceApiClient } from './keycloak-client-providers.js';

describe('Keycloak API Clients', () => {
    let module: TestingModule;

    let serviceClient: KeycloakAdminClient;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, KeycloakConfigTestModule.forRoot({ isKeycloakRequired: true })],
            providers: [KeycloakServiceApiClient],
        }).compile();

        serviceClient = module.get(KC_SERVICE_CLIENT);
    }, 10000000);

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should get access token', async () => {
        const accessToken: string | undefined = await serviceClient.getAccessToken();

        expect(accessToken).toBeDefined();
    });

    it('should get another access token after the first has expired', async () => {
        const firstAccessToken: string | undefined = await serviceClient.getAccessToken();

        jest.advanceTimersByTime(60 * 60 * 1000); // One hour

        const secondAccessToken: string | undefined = await serviceClient.getAccessToken();

        expect(firstAccessToken).toBeDefined();
        expect(secondAccessToken).toBeDefined();
        expect(firstAccessToken).not.toBe(secondAccessToken);
    });
});
