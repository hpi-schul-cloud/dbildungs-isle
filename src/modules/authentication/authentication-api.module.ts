import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logging/logger.module.js';
import { AuthenticationController } from './api/authentication.controller.js';
import { OpenIdConnectStrategy } from './passport/oidc.strategy.js';
import { InternalCommunicationApiKeyStrategy } from './passport/internalcommunicationapikey.strategy.js';
import { SessionSerializer } from './passport/session.serializer.js';
import { OIDCClientProvider } from './services/oidc-client.service.js';
import { PersonPermissionsRepo } from './domain/person-permission.repo.js';
import { PersonModule } from '../person/person.module.js';
import { SessionAccessTokenMiddleware } from './services/session-access-token.middleware.js';
import { PersonenKontextModule } from '../personenkontext/personenkontext.module.js';
import { JwtStrategy } from './passport/jwt.strategy.js';
import { OrganisationModule } from '../organisation/organisation.module.js';
import { RolleModule } from '../rolle/rolle.module.js';
import { KeycloakAdministrationModule } from '../keycloak-administration/keycloak-administration.module.js';
import { UserExternaldataWorkflowFactory } from './domain/user-extenaldata.factory.js';
import { KeycloakInternalController } from './api/keycloakinternal.controller.js';

@Module({
    imports: [
        HttpModule,
        LoggerModule.register(AuthenticationApiModule.name),
        PersonModule,
        PersonenKontextModule,
        OrganisationModule,
        RolleModule,
        KeycloakAdministrationModule,
    ],
    providers: [
        OpenIdConnectStrategy,
        JwtStrategy,
        InternalCommunicationApiKeyStrategy,
        SessionSerializer,
        OIDCClientProvider,
        PersonPermissionsRepo,
        SessionAccessTokenMiddleware,
        UserExternaldataWorkflowFactory,
    ],
    controllers: [AuthenticationController, KeycloakInternalController],
    exports: [OIDCClientProvider, PersonPermissionsRepo],
})
export class AuthenticationApiModule {}
