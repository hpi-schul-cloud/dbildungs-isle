import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DbConfig } from './db.config.js';
import { FrontendConfig } from './frontend.config.js';
import { HostConfig } from './host.config.js';
import { DataConfig } from './data.config.js';
import { KeycloakConfig } from './keycloak.config.js';
import { LoggingConfig } from './logging.config.js';
import { RedisConfig } from './redis.config.js';
import { LdapConfig } from './ldap.config.js';
import { ItsLearningConfig } from './itslearning.config.js';
import { PrivacyIdeaConfig } from './privacyidea.config.js';
import { SystemConfig } from './system.config.js';
import { OxConfig } from './ox.config.js';
import { ImportConfig } from './import.config.js';
import { FeatureFlagConfig } from './featureflag.config.js';
import { VidisConfig } from './vidis.config.js';
import { HeaderApiKeyConfig } from './headerapikey.config.js';

export class JsonConfig {
    @ValidateNested()
    @Type(() => HostConfig)
    public readonly HOST!: HostConfig;

    @ValidateNested()
    @Type(() => FrontendConfig)
    public readonly FRONTEND!: FrontendConfig;

    @ValidateNested()
    @Type(() => DbConfig)
    public readonly DB!: DbConfig;

    @ValidateNested()
    @Type(() => KeycloakConfig)
    public readonly KEYCLOAK!: KeycloakConfig;

    @ValidateNested()
    @Type(() => LoggingConfig)
    public readonly LOGGING!: LoggingConfig;

    @ValidateNested()
    @Type(() => RedisConfig)
    public readonly REDIS!: RedisConfig;

    @ValidateNested()
    @Type(() => LdapConfig)
    public readonly LDAP!: LdapConfig;

    @ValidateNested()
    @Type(() => FeatureFlagConfig)
    public readonly FEATUREFLAG!: FeatureFlagConfig;

    @ValidateNested()
    @Type(() => DataConfig)
    public readonly DATA!: DataConfig;

    @ValidateNested()
    @Type(() => ItsLearningConfig)
    public readonly ITSLEARNING!: ItsLearningConfig;

    @ValidateNested()
    @Type(() => PrivacyIdeaConfig)
    public readonly PRIVACYIDEA!: PrivacyIdeaConfig;

    @ValidateNested()
    @Type(() => OxConfig)
    public readonly OX!: OxConfig;

    @ValidateNested()
    @Type(() => ImportConfig)
    public readonly IMPORT!: ImportConfig;

    @ValidateNested()
    @Type(() => SystemConfig)
    public readonly SYSTEM!: SystemConfig;

    @ValidateNested()
    @Type(() => VidisConfig)
    public readonly VIDIS!: VidisConfig;

    @ValidateNested()
    @Type(() => HeaderApiKeyConfig)
    public readonly HEADER_API_KEY!: HeaderApiKeyConfig;
}
