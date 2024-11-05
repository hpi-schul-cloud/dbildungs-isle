import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthorizationParameters, Client, Strategy, StrategyOptions, TokenSet, UserinfoResponse } from 'openid-client';

import { FrontendConfig, ServerConfig } from '../../../shared/config/index.js';
import { OIDC_CLIENT } from '../services/oidc-client.service.js';
import { PassportUser } from '../types/user.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { KeycloakUserNotFoundError } from '../domain/keycloak-user-not-found.error.js';
import { Request } from 'express';
import { JwtPayload, decode } from 'jsonwebtoken';

export interface CustomJwtPayload extends JwtPayload {
    acr: StepUpLevel;
}

export enum StepUpLevel {
    NONE = 'none',
    SILVER = 'silver',
    GOLD = 'gold',
}

export function extractStepUpLevelFromJWT(jwt: string | undefined): StepUpLevel {
    if (!jwt) {
        return StepUpLevel.NONE;
    }

    const decoded: CustomJwtPayload | null = decode(jwt) as CustomJwtPayload | null;
    return decoded?.acr ?? StepUpLevel.NONE;
}

@Injectable()
export class OpenIdConnectStrategy extends PassportStrategy(Strategy, 'oidc') {
    public constructor(
        @Inject(OIDC_CLIENT) private client: Client,
        configService: ConfigService<ServerConfig>,
        private personRepo: PersonRepository,
    ) {
        const frontendConfig: FrontendConfig = configService.getOrThrow<FrontendConfig>('FRONTEND');

        super({
            client,
            usePKCE: true,
            params: { redirect_uri: frontendConfig.OIDC_CALLBACK_URL },
            passReqToCallback: true,
        } satisfies StrategyOptions);
    }

    public override authenticate(req: Request): void {
        const requiredStepUpLevel: string =
            (req.query['requiredStepUpLevel'] as StepUpLevel | undefined) ?? StepUpLevel.SILVER;

        const options: { acr_values: string } = {
            acr_values: requiredStepUpLevel,
        };

        super.authenticate(req, options);
    }

    public async validate(req: Request, tokenset: TokenSet): Promise<AuthorizationParameters & PassportUser> {
        let userinfo: UserinfoResponse;
        let person: Option<Person<true>>;

        try {
            userinfo = await this.client.userinfo(tokenset);
            person = await this.personRepo.findByKeycloakUserId(userinfo.sub);
        } catch (err: unknown) {
            throw new UnauthorizedException();
        }

        if (!person) {
            if (tokenset.access_token) {
                await this.client.revoke(tokenset.access_token, 'access_token');
            }

            throw new KeycloakUserNotFoundError();
        }

        const idToken: string | undefined = tokenset.id_token;
        const accessToken: string | undefined = tokenset.access_token;
        const refreshToken: string | undefined = tokenset.refresh_token;

        const user: AuthorizationParameters & PassportUser = {
            id_token: idToken,
            access_token: accessToken,
            refresh_token: refreshToken,
            userinfo: userinfo,
            personPermissions: () => Promise.reject(),
            redirect_uri: req.session?.redirectUrl,
        };
        return user;
    }
}
