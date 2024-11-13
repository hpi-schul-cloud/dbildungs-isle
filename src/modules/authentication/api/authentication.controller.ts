import { Controller, Get, Inject, Req, Res, Session, UseFilters, UseGuards, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ApiBearerAuth,
    ApiInternalServerErrorResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SessionData } from 'express-session';
import { Client } from 'openid-client';

import { FrontendConfig, KeycloakConfig, ServerConfig } from '../../../shared/config/index.js';
import { OIDC_CLIENT } from '../services/oidc-client.service.js';
import { LoginGuard } from './login.guard.js';
import { RedirectQueryParams } from './redirect.query.params.js';
import { UserinfoExtension, UserinfoResponse } from './userinfo.response.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonPermissions, PersonenkontextRolleFields } from '../domain/person-permissions.js';
import { Permissions } from './permissions.decorator.js';
import { Public } from './public.decorator.js';
import { RolleID } from '../../../shared/types/index.js';
import { PersonenkontextRolleFieldsResponse } from './personen-kontext-rolle-fields.response.js';
import { RollenSystemRechtServiceProviderIDResponse } from './rolle-systemrechte-serviceproviderid.response.js';
import { AuthenticationExceptionFilter } from './authentication-exception-filter.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { extractStepUpLevelFromJWT } from '../passport/oidc.strategy.js';

@UseFilters(new AuthenticationExceptionFilter())
@ApiTags('auth')
@Controller({ path: 'auth' })
export class AuthenticationController {
    private readonly defaultLoginRedirect: string;

    private readonly logoutRedirect: string;

    private readonly keyCloakclientRealm: string;

    public constructor(
        configService: ConfigService<ServerConfig>,
        @Inject(OIDC_CLIENT) private client: Client,
        private readonly logger: ClassLogger,
        private keycloakUserService: KeycloakUserService,
    ) {
        const frontendConfig: FrontendConfig = configService.getOrThrow<FrontendConfig>('FRONTEND');
        const keycloakConfig: KeycloakConfig = configService.getOrThrow<KeycloakConfig>('KEYCLOAK');
        this.keyCloakclientRealm = keycloakConfig.REALM_NAME;
        this.defaultLoginRedirect = frontendConfig.DEFAULT_LOGIN_REDIRECT;
        this.logoutRedirect = frontendConfig.LOGOUT_REDIRECT;
    }

    @Get('login')
    @Public()
    @UseGuards(LoginGuard)
    @ApiOperation({ summary: 'Used to start OIDC authentication.' })
    @ApiResponse({ status: 302, description: 'Redirection to orchestrate OIDC flow.' })
    @ApiQuery({ type: RedirectQueryParams })
    public login(@Res() res: Response, @Session() session: SessionData): void {
        const target: string = session.passport?.user.redirect_uri ?? this.defaultLoginRedirect;
        res.redirect(target);
    }

    @Get('logout')
    @Public()
    @ApiBearerAuth()
    @ApiOAuth2(['openid'])
    @ApiOperation({ summary: 'Used to log out the current user.' })
    @ApiResponse({ status: 302, description: 'Redirect to logout.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while trying to log out.' })
    public logout(@Req() req: Request, @Res() res: Response): void {
        const idToken: string | undefined = req.passportUser?.id_token;

        req.logout((logoutErr?: Error) => {
            if (logoutErr) {
                // Error should not stop logout process
                this.logger.info('An error occurres while trying to log out', logoutErr);
            }

            req.session.destroy((destroyErr?: Error) => {
                if (destroyErr) {
                    // Error should not stop logout process
                    this.logger.info('An error occurred while trying to destroy the session', destroyErr);
                }

                if (this.client.issuer.metadata.end_session_endpoint) {
                    const endSessionUrl: string = this.client.endSessionUrl({
                        id_token_hint: idToken,
                        post_logout_redirect_uri: this.logoutRedirect,
                        client_id: this.client.metadata.client_id,
                    });

                    res.redirect(endSessionUrl);
                } else {
                    res.redirect(this.logoutRedirect);
                }
            });
        });
    }

    @Get('logininfo')
    @ApiBearerAuth()
    @ApiOAuth2(['openid'])
    @ApiOperation({ summary: 'Info about logged in user.' })
    @ApiUnauthorizedResponse({ description: 'User is not logged in.' })
    @ApiOkResponse({ description: 'Returns info about the logged in user.', type: UserinfoResponse })
    public async info(@Permissions() permissions: PersonPermissions, @Req() req: Request): Promise<UserinfoResponse> {
        const roleIds: RolleID[] = await permissions.getRoleIds();
        this.logger.info('Roles: ' + roleIds.toString());
        this.logger.info('User: ' + JSON.stringify(permissions.personFields));
        const rolleFields: PersonenkontextRolleFields[] = await permissions.getPersonenkontextewithRoles();
        const rolleFieldsResponse: PersonenkontextRolleFieldsResponse[] = rolleFields.map(
            (field: PersonenkontextRolleFields) =>
                new PersonenkontextRolleFieldsResponse(
                    field.organisationsId,
                    new RollenSystemRechtServiceProviderIDResponse(
                        field.rolle.systemrechte,
                        field.rolle.serviceProviderIds,
                    ),
                ),
        );
        const userinfoExtension: UserinfoExtension = {};
        if (permissions.personFields.keycloakUserId) {
            const lastPasswordChange: Result<Date, DomainError> = await this.keycloakUserService.getLastPasswordChange(
                permissions.personFields.keycloakUserId,
            );
            if (lastPasswordChange.ok) userinfoExtension.password_updated_at = lastPasswordChange.value;
        }

        return new UserinfoResponse(
            permissions,
            rolleFieldsResponse,
            extractStepUpLevelFromJWT(req.passportUser?.id_token),
            userinfoExtension,
        );
    }

    @Get('reset-password')
    @Public()
    @ApiOperation({ summary: 'Redirect to Keycloak password reset.' })
    @ApiResponse({ status: 302, description: 'Redirect to Keycloak password reset page.' })
    public resetPassword(
        @Query('redirectUrl') redirectUrl: string,
        @Query('login_hint') login_hint: string,
        @Res() res: Response,
    ): void {
        const clientId: string = this.keyCloakclientRealm.toLowerCase();
        const responseType: string = 'code';
        const scope: string = 'openid';
        const kcAction: string = 'UPDATE_PASSWORD';
        const endpoint: string | undefined = this.client.issuer.metadata.authorization_endpoint;
        const setNewPasswordUrl: string = `${endpoint}?client_id=${clientId}&login_hint=${login_hint}&response_type=${responseType}&scope=${scope}&kc_action=${kcAction}&redirect_uri=${redirectUrl}`;
        res.redirect(setNewPasswordUrl);
    }
}
