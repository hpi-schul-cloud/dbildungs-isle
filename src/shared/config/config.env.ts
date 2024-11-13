import { DbConfig } from './db.config.js';
import { KeycloakConfig } from './keycloak.config.js';
import { FrontendConfig } from './frontend.config.js';
import { HostConfig } from './host.config.js';
import { ItsLearningConfig } from './itslearning.config.js';
import { LdapConfig } from './ldap.config.js';
import { PrivacyIdeaConfig } from './privacyidea.config.js';
import { OxConfig } from './ox.config.js';
import { RedisConfig } from './redis.config.js';

export default (): {
    DB: Partial<DbConfig>;
    KEYCLOAK: Partial<KeycloakConfig>;
    REDIS: Partial<RedisConfig>;
    LDAP: Partial<LdapConfig>;
    FRONTEND: Partial<FrontendConfig>;
    HOST: Partial<HostConfig>;
    ITSLEARNING: Partial<ItsLearningConfig>;
    PRIVACYIDEA: Partial<PrivacyIdeaConfig>;
    OX: Partial<OxConfig>;
} => ({
    DB: {
        DB_NAME: process.env['DB_NAME'],
        USERNAME: process.env['DB_USERNAME'],
        SECRET: process.env['DB_SECRET'],
        CLIENT_URL: process.env['DB_CLIENT_URL'],
    },
    KEYCLOAK: {
        ADMIN_SECRET: process.env['KC_ADMIN_SECRET'],
        CLIENT_SECRET: process.env['KC_CLIENT_SECRET'],
        SERVICE_CLIENT_PRIVATE_JWKS: process.env['KC_SERVICE_CLIENT_PRIVATE_JWKS'],
        BASE_URL: process.env['KC_BASE_URL'],
    },
    LDAP: {
        URL: process.env['LDAP_URL'],
        BIND_DN: process.env['LDAP_BIND_DN'],
        ADMIN_PASSWORD: process.env['LDAP_ADMIN_PASSWORD'],
    },
    FRONTEND: {
        SESSION_SECRET: process.env['FRONTEND_SESSION_SECRET'],
        OIDC_CALLBACK_URL: process.env['FRONTEND_OIDC_CALLBACK_URL'],
        DEFAULT_LOGIN_REDIRECT: process.env['FRONTEND_DEFAULT_LOGIN_REDIRECT'],
        LOGOUT_REDIRECT: process.env['FRONTEND_LOGOUT_REDIRECT'],
    },
    HOST: {
        HOSTNAME: process.env['BACKEND_HOSTNAME'],
    },
    REDIS: {
        PASSWORD: process.env['REDIS_PASSWORD'],
    },
    ITSLEARNING: {
        ENABLED: process.env['ITSLEARNING_ENABLED']?.toLowerCase() as 'true' | 'false',
        ENDPOINT: process.env['ITSLEARNING_ENDPOINT'],
        USERNAME: process.env['ITSLEARNING_USERNAME'],
        PASSWORD: process.env['ITSLEARNING_PASSWORD'],
    },
    PRIVACYIDEA: {
        ENDPOINT: process.env['PI_BASE_URL'],
        USERNAME: process.env['PI_ADMIN_USER'],
        PASSWORD: process.env['PI_ADMIN_PASSWORD'],
        USER_RESOLVER: process.env['PI_USER_RESOLVER'],
        REALM: process.env['PI_REALM'],
        RENAME_WAITING_TIME_IN_SECONDS: parseInt(process.env['PI_RENAME_WAITING_TIME'] || '0'),
    },
    OX: {
        ENABLED: process.env['OX_ENABLED']?.toLowerCase() as 'true' | 'false',
        ENDPOINT: process.env['OX_ENDPOINT'],
        USERNAME: process.env['OX_USERNAME'],
        PASSWORD: process.env['OX_PASSWORD'],
    },
});
