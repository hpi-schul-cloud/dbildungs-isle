import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Post,
    Query,
    Put,
    UseFilters,
} from '@nestjs/common';
import { PrivacyIdeaAdministrationService } from './privacy-idea-administration.service.js';
import { Public } from '../authentication/api/public.decorator.js';
import { PrivacyIdeaToken, ResetTokenResponse, AssignTokenResponse } from './privacy-idea-api.types.js';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TokenStateResponse } from './token-state.response.js';
import { TokenInitBodyParams } from './token-init.body.params.js';
import { PersonPermissions } from '../authentication/domain/person-permissions.js';
import { Permissions } from '../authentication/api/permissions.decorator.js';
import { Person } from '../person/domain/person.js';
import { PersonRepository } from '../person/persistence/person.repository.js';
import { TokenVerifyBodyParams } from './token-verify.params.js';
import { AssignHardwareTokenBodyParams } from './api/assign-hardware-token.body.params.js';
import { AssignHardwareTokenResponse } from './api/assign-hardware-token.response.js';
import { TokenError } from './api/error/token.error.js';
import { PrivacyIdeaAdministrationExceptionFilter } from './api/privacy-idea-administration-exception-filter.js';
import { SchulConnexErrorMapper } from '../../shared/error/schul-connex-error.mapper.js';
import { EntityCouldNotBeCreated } from '../../shared/error/entity-could-not-be-created.error.js';
import { EntityCouldNotBeUpdated } from '../../shared/error/entity-could-not-be-updated.error.js';

@UseFilters(new PrivacyIdeaAdministrationExceptionFilter())
@ApiTags('2FA')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller('2fa-token')
export class PrivacyIdeaAdministrationController {
    public constructor(
        private readonly privacyIdeaAdministrationService: PrivacyIdeaAdministrationService,
        private readonly personRepository: PersonRepository,
    ) {}

    @Post('init')
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ description: 'The token was successfully created.', type: String })
    @ApiBadRequestResponse({ description: 'A username was not given or not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create token.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create token.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to create token.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating a token.' })
    public async initializeSoftwareToken(
        @Body() params: TokenInitBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<string> {
        const person: Person<true> = await this.getPersonIfAllowed(params.personId, permissions);

        const selfService: boolean = person.id === permissions.personFields.id;

        return this.privacyIdeaAdministrationService.initializeSoftwareToken(person.referrer!, selfService);
    }

    @Get('state')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({ description: 'The token was successfully created.', type: TokenStateResponse })
    @ApiBadRequestResponse({ description: 'A username was not given or not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create token.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create token.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to create token.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating a token.' })
    public async getTwoAuthState(
        @Query('personId') personId: string,
        @Permissions() permissions: PersonPermissions,
    ): Promise<TokenStateResponse> {
        const person: Person<true> = await this.getPersonIfAllowed(personId, permissions);
        const piToken: PrivacyIdeaToken | undefined = await this.privacyIdeaAdministrationService.getTwoAuthState(
            person.referrer!,
        );
        return new TokenStateResponse(piToken);
    }

    @Put('reset')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({ description: 'The token was successfully reset.', type: Boolean })
    @ApiBadRequestResponse({ description: 'A username was not given or not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to reset token.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to reset token.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to reset token.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while reseting a token.' })
    @Public()
    public async resetToken(
        @Query('personId') personId: string,
        @Permissions() permissions: PersonPermissions,
    ): Promise<boolean> {
        const person: Person<true> = await this.getPersonIfAllowed(personId, permissions);
        try {
            const response: ResetTokenResponse = await this.privacyIdeaAdministrationService.resetToken(
                person.referrer!,
            );
            return response.result.status;
        } catch (error) {
            if (error instanceof TokenError) {
                throw error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeUpdated(person.referrer!, 'Token could not be unassigned.'),
                ),
            );
        }
    }

    @Post('assign/hardwareToken')
    @HttpCode(HttpStatus.OK)
    @ApiCreatedResponse({
        description: 'The hardware token was successfully assigned.',
        type: AssignHardwareTokenResponse,
    })
    @ApiBadRequestResponse({ description: 'Not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to assign hardware token.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to reset token.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to assign hardware token.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while assigning a hardware token.' })
    public async assignHardwareToken(
        @Body() params: AssignHardwareTokenBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<AssignHardwareTokenResponse | undefined> {
        const person: Person<true> = await this.getPersonIfAllowed(params.userId, permissions);
        try {
            const result: AssignTokenResponse = await this.privacyIdeaAdministrationService.assignHardwareToken(
                params.serial,
                params.otp,
                person.referrer!,
            );
            return new AssignHardwareTokenResponse(
                result.id,
                result.jsonrpc,
                result.time,
                result.version,
                result.versionnumber,
                result.signature,
                'Token wurde erfolgreich zugeordnet.',
            );
        } catch (error) {
            if (error instanceof TokenError) {
                throw error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeCreated('Hardware-Token could not be assigned.'),
                ),
            );
        }
    }

    @Post('verify')
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ description: 'The token was successfully verified.' })
    @ApiBadRequestResponse({ description: 'A username was not given or not found.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to verify token.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to verify token.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to verify token.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while verifying a token.' })
    public async verifyToken(
        @Body() params: TokenVerifyBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<void> {
        const person: Person<true> = await this.getPersonIfAllowed(params.personId, permissions);

        await this.privacyIdeaAdministrationService.verifyTokenEnrollment(person.referrer!, params.otp);
    }

    private async getPersonIfAllowed(personId: string, permissions: PersonPermissions): Promise<Person<true>> {
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            personId,
            permissions,
        );
        if (!personResult.ok) {
            throw new HttpException(personResult.error, HttpStatus.FORBIDDEN);
        }
        if (personResult.value.referrer === undefined) {
            throw new HttpException('User not found.', HttpStatus.BAD_REQUEST);
        }
        return personResult.value;
    }
}
