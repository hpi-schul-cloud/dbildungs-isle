import { DbConfig } from './db.config.js';
import { KeycloakConfig } from './keycloak.config.js';
import { FrontendConfig } from './frontend.config.js';
import { HostConfig } from './host.config.js';
import { ItsLearningConfig } from './itslearning.config.js';
import { LdapConfig } from './ldap.config.js';
import { PrivacyIdeaConfig } from './privacyidea.config.js';
import { SystemConfig } from './system.config.js';
import { OxConfig } from './ox.config.js';
import { RedisConfig } from './redis.config.js';
import { FeatureFlagConfig } from './featureflag.config.js';
import { envToOptionalBoolean } from './utils.js';
import { VidisConfig } from './vidis.config.js';
import { ImportConfig } from './import.config.js';

export type Config = {
    DB: Partial<DbConfig>;
    KEYCLOAK: Partial<KeycloakConfig>;
    REDIS: Partial<RedisConfig>;
    LDAP: Partial<LdapConfig>;
    FRONTEND: Partial<FrontendConfig>;
    FEATUREFLAG: Partial<FeatureFlagConfig>;
    HOST: Partial<HostConfig>;
    ITSLEARNING: Partial<ItsLearningConfig>;
    PRIVACYIDEA: Partial<PrivacyIdeaConfig>;
    OX: Partial<OxConfig>;
    SYSTEM: Partial<SystemConfig>;
    VIDIS: Partial<VidisConfig>;
    IMPORT: Partial<ImportConfig>;
};

export default (): Config => ({
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
        EXTERNAL_BASE_URL: process.env['KC_EXTERNAL_BASE_URL'],
    },
    LDAP: {
        URL: process.env['LDAP_URL'],
        BIND_DN: process.env['LDAP_BIND_DN'],
        ADMIN_PASSWORD: process.env['LDAP_ADMIN_PASSWORD'],
        OEFFENTLICHE_SCHULEN_DOMAIN: process.env['LDAP_OEFFENTLICHE_SCHULEN_DOMAIN'],
        ERSATZSCHULEN_DOMAIN: process.env['LDAP_ERSATZSCHULEN_DOMAIN'],
        BASE_DN: process.env['LDAP_BASE_DN'],
    },
    FRONTEND: {
        SESSION_SECRET: process.env['FRONTEND_SESSION_SECRET'],
        OIDC_CALLBACK_URL: process.env['FRONTEND_OIDC_CALLBACK_URL'],
        DEFAULT_LOGIN_REDIRECT: process.env['FRONTEND_DEFAULT_LOGIN_REDIRECT'],
        LOGOUT_REDIRECT: process.env['FRONTEND_LOGOUT_REDIRECT'],
        STATUS_REDIRECT_URL: process.env['STATUS_REDIRECT_URL'],
    },
    FEATUREFLAG: {
        FEATURE_FLAG_ROLLE_BEARBEITEN:
            (process.env['FEATURE_FLAG_ROLLE_BEARBEITEN']?.toLowerCase() as 'true' | 'false') ?? 'false',
        FEATURE_FLAG_BEFRISTUNG_BEARBEITEN:
            (process.env['FEATURE_FLAG_BEFRISTUNG_BEARBEITEN']?.toLowerCase() as 'true' | 'false') ?? 'false',
    },
    HOST: {
        HOSTNAME: process.env['BACKEND_HOSTNAME'],
    },
    REDIS: {
        PASSWORD: process.env['REDIS_PASSWORD'],
    },
    ITSLEARNING: {
        ENABLED: envToOptionalBoolean('ITSLEARNING_ENABLED'),
        ENDPOINT: process.env['ITSLEARNING_ENDPOINT'],
        USERNAME: process.env['ITSLEARNING_USERNAME'],
        PASSWORD: process.env['ITSLEARNING_PASSWORD'],
        ROOT: process.env['ITSLEARNING_ROOT'],
        ROOT_OEFFENTLICH: process.env['ITSLEARNING_ROOT_OEFFENTLICH'],
        ROOT_ERSATZ: process.env['ITSLEARNING_ROOT_ERSATZ'],
    },
    PRIVACYIDEA: {
        ENDPOINT: process.env['PI_BASE_URL'],
        USERNAME: process.env['PI_ADMIN_USER'],
        PASSWORD: process.env['PI_ADMIN_PASSWORD'],
        USER_RESOLVER: process.env['PI_USER_RESOLVER'],
        REALM: process.env['PI_REALM'],
    },
    OX: {
        ENABLED: envToOptionalBoolean('OX_ENABLED'),
        ENDPOINT: process.env['OX_ENDPOINT'],
        USERNAME: process.env['OX_USERNAME'],
        PASSWORD: process.env['OX_PASSWORD'],
        CONTEXT_ID: process.env['OX_CONTEXT_ID'],
        CONTEXT_NAME: process.env['OX_CONTEXT_NAME'],
    },
    SYSTEM: {
        RENAME_WAITING_TIME_IN_SECONDS: process.env['SYSTEM_RENAME_WAITING_TIME_IN_SECONDS']
            ? parseInt(process.env['SYSTEM_RENAME_WAITING_TIME_IN_SECONDS'])
            : undefined,
        STEP_UP_TIMEOUT_IN_SECONDS: process.env['SYSTEM_STEP_UP_TIMEOUT_IN_SECONDS']
            ? parseInt(process.env['SYSTEM_STEP_UP_TIMEOUT_IN_SECONDS'])
            : undefined,
        STEP_UP_TIMEOUT_ENABLED: process.env['SYSTEM_STEP_UP_TIMEOUT_ENABLED']?.toLowerCase() as 'true' | 'false',
    },
    VIDIS: {
        BASE_URL: process.env['VIDIS_BASE_URL'],
        USERNAME: process.env['VIDIS_USERNAME'],
        PASSWORD: process.env['VIDIS_PASSWORD'],
        REGION_NAME: process.env['VIDIS_REGION_NAME'],
        KEYCLOAK_GROUP: process.env['VIDIS_KEYCLOAK_GROUP'],
        KEYCLOAK_ROLE: process.env['VIDIS_KEYCLOAK_ROLE'],
    },
    IMPORT: {
        PASSPHRASE_SECRET: process.env['IMPORT_PASSPHRASE_SECRET'],
        PASSPHRASE_SALT: process.env['IMPORT_PASSPHRASE_SALT'],
        CSV_FILE_MAX_SIZE_IN_MB: isNaN(Number(process.env['CSV_FILE_MAX_SIZE_IN_MB']))
            ? undefined
            : Number(process.env['IMPORT_CSV_FILE_MAX_SIZE_IN_MB']),
        CSV_MAX_NUMBER_OF_USERS: isNaN(Number(process.env['CSV_MAX_NUMBER_OF_USERS']))
            ? undefined
            : Number(process.env['IMPORT_CSV_MAX_NUMBER_OF_USERS']),
    },
});
