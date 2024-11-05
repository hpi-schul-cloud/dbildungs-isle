import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { KeycloakUserNotFoundError } from '../domain/keycloak-user-not-found.error.js';
import { HttpFoundException } from '../../../shared/error/http.found.exception.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { FrontendConfig } from '../../../shared/config/frontend.config.js';
import { AuthenticationErrorI18nTypes } from './dbiam-authentication.error.js';
import { CustomJwtPayload, StepUpLevel } from '../passport/oidc.strategy.js';
import { decode } from 'jsonwebtoken';

@Injectable()
export class LoginGuard extends AuthGuard(['jwt', 'oidc']) {
    public constructor(
        private logger: ClassLogger,
        private configService: ConfigService<ServerConfig>,
    ) {
        super();
    }

    public override async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: Request = context.switchToHttp().getRequest<Request>();
        const res: Response = context.switchToHttp().getResponse<Response>();
        const stepup: StepUpLevel = request.query['requiredStepUpLevel'] as StepUpLevel;

        if (request.query['redirectUrl']) {
            request.session.redirectUrl = request.query['redirectUrl'] as string;
        }

        let decodedIdToken: CustomJwtPayload | null = null;
        if (request.passportUser?.access_token) {
            decodedIdToken = decode(request.passportUser?.access_token) as CustomJwtPayload | null;
        }

        if (stepup === decodedIdToken?.acr && request.isAuthenticated()) {
            return true;
        }

        try {
            if (!(await super.canActivate(context))) {
                return false;
            }
            await super.logIn(request);
        } catch (err) {
            this.logger.info(JSON.stringify(err));

            if (err instanceof KeycloakUserNotFoundError) {
                //Redirect to error page
                const frontendConfig: FrontendConfig = this.configService.getOrThrow<FrontendConfig>('FRONTEND');
                res.setHeader('location', frontendConfig.ERROR_PAGE_REDIRECT).status(403);
                const msg: Record<string, unknown> = {
                    DbiamAuthenticationError: {
                        code: 403,
                        i18nKey: AuthenticationErrorI18nTypes.KEYCLOAK_USER_NOT_FOUND,
                    },
                };
                throw new HttpFoundException(msg);
            }

            return false;
        }

        return request.isAuthenticated();
    }
}
