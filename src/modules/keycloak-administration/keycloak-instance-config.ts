import { Injectable, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakConfig, ServerConfig } from '../../shared/config/index.js';

@Injectable()
export class KeycloakInstanceConfig implements KeycloakConfig {
    public constructor(
        public BASE_URL: string,
        public ADMIN_REALM_NAME: string,
        public ADMIN_CLIENT_ID: string,
        public ADMIN_SECRET: string,
        public SERVICE_CLIENT_ID: string,
        public SERVICE_CLIENT_PRIVATE_JWKS: string,
        public REALM_NAME: string,
        public CLIENT_ID: string,
        public CLIENT_SECRET: string,
        public TEST_CLIENT_ID: string,
    ) {}

    public static fromConfigService(): Provider {
        return {
            provide: KeycloakInstanceConfig,
            useFactory: (configService: ConfigService<ServerConfig>): KeycloakInstanceConfig => {
                const keycloakConfig: KeycloakConfig = configService.getOrThrow<KeycloakConfig>('KEYCLOAK');

                return new KeycloakInstanceConfig(
                    keycloakConfig.BASE_URL,
                    keycloakConfig.ADMIN_REALM_NAME,
                    keycloakConfig.ADMIN_CLIENT_ID,
                    keycloakConfig.ADMIN_SECRET,
                    keycloakConfig.SERVICE_CLIENT_ID,
                    keycloakConfig.SERVICE_CLIENT_PRIVATE_JWKS,
                    keycloakConfig.REALM_NAME,
                    keycloakConfig.CLIENT_ID,
                    keycloakConfig.CLIENT_SECRET,
                    keycloakConfig.TEST_CLIENT_ID,
                );
            },
            inject: [ConfigService],
        };
    }
}
