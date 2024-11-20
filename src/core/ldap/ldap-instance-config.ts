import { Injectable, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../shared/config/index.js';
import { LdapConfig } from '../../shared/config/ldap.config.js';

@Injectable()
export class LdapInstanceConfig implements LdapConfig {
    public constructor(
        public URL: string,
        public BIND_DN: string,
        public ADMIN_PASSWORD: string,
        public OEFFENTLICHE_SCHULEN_DOMAIN?: string,
        public ERSATZSCHULEN_DOMAIN?: string,
    ) {}

    public static fromConfigService(): Provider {
        return {
            provide: LdapInstanceConfig,
            useFactory: (configService: ConfigService<ServerConfig>): LdapInstanceConfig => {
                const ldapConfig: LdapConfig = configService.getOrThrow<LdapConfig>('LDAP');

                return new LdapInstanceConfig(
                    ldapConfig.URL,
                    ldapConfig.BIND_DN,
                    ldapConfig.ADMIN_PASSWORD,
                    ldapConfig.OEFFENTLICHE_SCHULEN_DOMAIN,
                    ldapConfig.ERSATZSCHULEN_DOMAIN,
                );
            },
            inject: [ConfigService],
        };
    }
}
