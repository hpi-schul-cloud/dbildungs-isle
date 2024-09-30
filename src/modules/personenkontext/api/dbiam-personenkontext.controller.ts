import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DomainError, EntityCouldNotBeCreated, MissingPermissionsError } from '../../../shared/error/index.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { DBiamPersonenkontextResponse } from './response/dbiam-personenkontext.response.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { DbiamPersonenkontextMigrationBodyParams } from './param/dbiam-personenkontext-migration.body.params.js';
import { DBiamFindPersonenkontexteByPersonIdParams } from './param/dbiam-find-personenkontext-by-personid.params.js';
import { DbiamPersonenkontextError } from './dbiam-personenkontext.error.js';
import { PersonenkontextExceptionFilter } from './personenkontext-exception-filter.js';
import { PersonenkontexteUpdateExceptionFilter } from './personenkontexte-update-exception-filter.js';
import { AuthenticationExceptionFilter } from '../../authentication/api/authentication-exception-filter.js';
import { RollenArt, RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { PersonenkontextSpecificationError } from '../specification/error/personenkontext-specification.error.js';
import { DBiamPersonenkontextRepoInternal } from '../persistence/internal-dbiam-personenkontext.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { PersonenkontextCreatedMigrationEvent } from '../../../shared/events/personenkontext-created-migration.event.js';
import { EventService } from '../../../core/eventbus/index.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';

@UseFilters(
    new SchulConnexValidationErrorFilter(),
    new PersonenkontextExceptionFilter(),
    new PersonenkontexteUpdateExceptionFilter(),
    new AuthenticationExceptionFilter(),
)
@ApiTags('dbiam-personenkontexte')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'dbiam/personenkontext' })
export class DBiamPersonenkontextController {
    public constructor(
        private readonly personenkontextRepo: DBiamPersonenkontextRepo,
        private readonly personenkontextFactory: PersonenkontextFactory,
        private readonly personenkontextRepoInternal: DBiamPersonenkontextRepoInternal,
        private readonly organisationRepo: OrganisationRepository,
        private readonly personRepo: PersonRepository,
        private readonly rolleRepo: RolleRepo,
        private readonly eventService: EventService,
        private readonly logger: ClassLogger,
    ) {}

    @Get(':personId')
    @ApiOkResponse({
        description: 'The personenkontexte were successfully returned.',
        type: [DBiamPersonenkontextResponse],
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get available personenkontexte.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get personenkontexte for this user.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting personenkontexte.' })
    public async findPersonenkontextsByPerson(
        @Param() params: DBiamFindPersonenkontexteByPersonIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<DBiamPersonenkontextResponse[]> {
        const result: Result<Personenkontext<true>[], DomainError> =
            await this.personenkontextRepo.findByPersonAuthorized(params.personId, permissions);

        if (!result.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
            );
        }

        return result.value.map((k: Personenkontext<true>) => new DBiamPersonenkontextResponse(k));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({
        description: 'Personenkontext was successfully created.',
        type: DBiamPersonenkontextResponse,
    })
    @ApiBadRequestResponse({
        description: 'The personenkontext could not be created, may due to unsatisfied specifications.',
        type: DbiamPersonenkontextError,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create personenkontext.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to create personenkontext.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating personenkontext.' })
    public async createPersonenkontextMigration(
        @Body() params: DbiamPersonenkontextMigrationBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<DBiamPersonenkontextResponse> {
        const isMigrationUser: boolean = await permissions.hasSystemrechteAtRootOrganisation([
            RollenSystemRecht.MIGRATION_DURCHFUEHREN,
        ]);
        if (!isMigrationUser) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new MissingPermissionsError('Migrationsrecht Required For This Endpoint'),
                ),
            );
        }

        const person: Option<Person<true>> = params.personId
            ? await this.personRepo.findById(params.personId)
            : params.username
              ? await this.personRepo.findByUsername(params.username)
              : null;

        if (!person) {
            this.logger.error(
                `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / Person does not exist`,
            );
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeCreated('Person does not exist'),
                ),
            );
        }

        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(params.rolleId);
        if (!rolle) {
            this.logger.error(
                `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / Rolle does not exist`,
            );
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeCreated('Rolle does not exist'),
                ),
            );
        }

        const orga: Option<Organisation<true>> = await this.organisationRepo.findById(params.organisationId);
        if (!orga) {
            this.logger.error(
                `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / Orga does not exist`,
            );
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeCreated('Orga does not exist'),
                ),
            );
        }

        const kontextToCreate: Personenkontext<false> = this.personenkontextFactory.createNew(
            person.id,
            orga.id,
            rolle.id,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            params.befristung,
        );

        const isPersonkontextAlreadyExisting: boolean = await this.personenkontextRepo.exists(
            person.id,
            orga.id,
            rolle.id,
        );
        if (isPersonkontextAlreadyExisting) {
            this.logger.error(
                `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / Kontext Already exist`,
            );
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityCouldNotBeCreated(`Kontext Already Exists`),
                ),
            );
        }

        if (
            (params.email && rolle.rollenart != RollenArt.LEHR) ||
            (!params.email && rolle.rollenart == RollenArt.LEHR)
        ) {
            this.logger.error(
                `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / An Email Must Only Be Provided For a Lehrerkontext`,
            );
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new PersonenkontextSpecificationError('An Email Must Only Be Provided For a Lehrerkontext'),
                ),
            );
        }

        const createdKontext: Personenkontext<true> = await this.personenkontextRepoInternal.save(kontextToCreate);
        this.logger.info(
            `MIGRATION: Create Kontext Operation / personId: ${params.personId} ;  orgaId: ${params.organisationId} ;  rolleId: ${params.rolleId} / New Kontext has been saved to DB successfully`,
        );

        this.eventService.publish(
            new PersonenkontextCreatedMigrationEvent(createdKontext, person, rolle, orga, params.email),
        );

        return new DBiamPersonenkontextResponse(createdKontext);
    }
}
