import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseFilters } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { FindPersonenkontextSchulstrukturknotenBodyParams } from './param/find-personenkontext-schulstrukturknoten.body.params.js';
import { FindSchulstrukturknotenResponse } from './response/find-schulstrukturknoten.response.js';
import { PersonenkontextWorkflowAggregate } from '../domain/personenkontext-workflow.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { OrganisationResponseLegacy } from '../../organisation/api/organisation.response.legacy.js';
import { PersonenkontextWorkflowFactory } from '../domain/personenkontext-workflow.factory.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { FindDbiamPersonenkontextWorkflowBodyParams } from './param/dbiam-find-personenkontextworkflow-body.params.js';
import { PersonenkontextWorkflowResponse } from './response/dbiam-personenkontext-workflow-response.js';
import { PersonenkontexteUpdateError } from '../domain/error/personenkontexte-update.error.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { DBiamFindPersonenkontexteByPersonIdParams } from './param/dbiam-find-personenkontext-by-personid.params.js';
import { DbiamUpdatePersonenkontexteBodyParams } from './param/dbiam-update-personenkontexte.body.params.js';
import { PersonenkontexteUpdateResponse } from './response/personenkontexte-update.response.js';
import { DbiamPersonenkontexteUpdateError } from './dbiam-personenkontexte-update.error.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { DBiamPersonResponse } from './response/dbiam-person.response.js';
import { DbiamPersonenkontextError } from './dbiam-personenkontext.error.js';
import { DbiamCreatePersonWithContextBodyParams } from './param/dbiam-create-person-with-context.body.params.js';
import { PersonPersonenkontext, PersonenkontextCreationService } from '../domain/personenkontext-creation.service.js';
import { PersonenkontextCommitError } from '../domain/error/personenkontext-commit.error.js';
import { PersonenkontextSpecificationError } from '../specification/error/personenkontext-specification.error.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { PersonenkontextExceptionFilter } from './personenkontext-exception-filter.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { PersonenkontexteUpdateExceptionFilter } from './personenkontexte-update-exception-filter.js';
import { DuplicatePersonalnummerError } from '../../../shared/error/duplicate-personalnummer.error.js';

@UseFilters(
    SchulConnexValidationErrorFilter,
    new PersonenkontextExceptionFilter(),
    new PersonenkontexteUpdateExceptionFilter(),
)
@ApiTags('personenkontext')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'personenkontext-workflow' })
export class DbiamPersonenkontextWorkflowController {
    public constructor(
        private readonly personenkontextWorkflowFactory: PersonenkontextWorkflowFactory,
        private readonly personenkontextCreationService: PersonenkontextCreationService,
    ) {}

    @Get('step')
    @ApiOkResponse({
        description: `Initialize or process data from the person creation form.
                      Valid combinations:
                      - Both organisationId and rolleId are undefined: Fetch all possible organisations.
                      - organisationId is provided, but rolleId is undefined: Fetch Rollen for the given organisation.
                      - Both organisationId and rolleId are provided: Check if the Rolle can be committed for the organisation.
                      Note: Providing rolleId without organisationId is invalid.`,
        type: PersonenkontextWorkflowResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get available data for personenkontext.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get data for personenkontext.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting data for personenkontext.' })
    public async processStep(
        @Query() params: FindDbiamPersonenkontextWorkflowBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonenkontextWorkflowResponse> {
        // Creates a new instance of the workflow aggregate
        const anlage: PersonenkontextWorkflowAggregate = this.personenkontextWorkflowFactory.createNew();

        // Initializes the aggregate with the values of the selected organisation and rolle through the UI
        // (Both values could be undefined when nothing was done yet)
        anlage.initialize(params.organisationId, params.rolleId);

        // Find all possible SSKs (Possibly through name if the name was given)
        const organisations: Organisation<true>[] = await anlage.findAllSchulstrukturknoten(
            permissions,
            params.organisationName,
        );

        // Find all possible roles under the selected Organisation
        const rollen: Rolle<true>[] = params.organisationId
            ? await anlage.findRollenForOrganisation(permissions, params.rolleName, params.limit)
            : [];

        const organisationsResponse: OrganisationResponseLegacy[] = organisations.map(
            (org: Organisation<true>) => new OrganisationResponseLegacy(org),
        );

        // Determine canCommit status, by default it's always false unless both the rolle and orga are selected
        let canCommit: boolean = false;
        if (params.organisationId && params.rolleId) {
            const commitResult: DomainError | boolean = await anlage.canCommit(permissions);
            if (commitResult === true) {
                canCommit = true;
            }
        }

        const response: PersonenkontextWorkflowResponse = new PersonenkontextWorkflowResponse(
            organisationsResponse,
            rollen,
            canCommit,
            params.organisationId,
            params.rolleId,
        );

        return response;
    }

    @Put(':personId')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description:
            'Add or remove personenkontexte as one operation. Returns the Personenkontexte existing after update.',
        type: PersonenkontexteUpdateResponse,
    })
    @ApiBadRequestResponse({
        description: 'The personenkontexte could not be updated, may due to unsatisfied specifications.',
        type: DbiamPersonenkontexteUpdateError,
    })
    @ApiConflictResponse({ description: 'Changes are conflicting with current state of personenkontexte.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to update personenkontexte.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to update personenkontexte.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while updating personenkontexte.' })
    public async commit(
        @Param() params: DBiamFindPersonenkontexteByPersonIdParams,
        @Body() bodyParams: DbiamUpdatePersonenkontexteBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonenkontexteUpdateResponse> {
        const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError =
            await this.personenkontextWorkflowFactory
                .createNew()
                .commit(
                    params.personId,
                    bodyParams.lastModified,
                    bodyParams.count,
                    bodyParams.personenkontexte,
                    permissions,
                );

        if (updateResult instanceof PersonenkontexteUpdateError) {
            throw updateResult;
        }
        return new PersonenkontexteUpdateResponse(updateResult);
    }

    @Get('schulstrukturknoten')
    @ApiOkResponse({
        description: 'The schulstrukturknoten for a personenkontext were successfully returned.',
        type: FindSchulstrukturknotenResponse,
    })
    @ApiUnauthorizedResponse({
        description: 'Not authorized to get available schulstrukturknoten for personenkontexte.',
    })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get schulstrukturknoten for personenkontext.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while getting schulstrukturknoten for personenkontexte.',
    })
    public async findSchulstrukturknoten(
        @Query() params: FindPersonenkontextSchulstrukturknotenBodyParams,
    ): Promise<FindSchulstrukturknotenResponse> {
        const anlage: PersonenkontextWorkflowAggregate = this.personenkontextWorkflowFactory.createNew();
        const sskName: string = params.sskName ?? '';
        const ssks: Organisation<true>[] = await anlage.findSchulstrukturknoten(
            params.rolleId,
            sskName,
            params.limit,
            true,
        );

        const sskResponses: OrganisationResponseLegacy[] = ssks.map(
            (org: Organisation<true>) => new OrganisationResponseLegacy(org),
        );
        const response: FindSchulstrukturknotenResponse = new FindSchulstrukturknotenResponse(
            sskResponses,
            ssks.length,
        );

        return response;
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({
        description: 'Person with Personenkontext was successfully created.',
        type: DBiamPersonResponse,
    })
    @ApiBadRequestResponse({
        description: 'The person and the personenkontext could not be created, may due to unsatisfied specifications.',
        type: DbiamPersonenkontextError,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create person with personenkontext.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to create person with personenkontext.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the person with personenkontext.' })
    @ApiBadRequestResponse({ description: 'Request has wrong format.', type: DbiamPersonenkontextError })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while creating person with personenkontext.',
    })
    public async createPersonWithKontext(
        @Body() params: DbiamCreatePersonWithContextBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<DBiamPersonResponse> {
        //Check all references & permissions then save person
        const savedPersonWithPersonenkontext:
            | PersonPersonenkontext
            | DomainError
            | PersonenkontextCommitError
            | DuplicatePersonalnummerError = await this.personenkontextCreationService.createPersonWithPersonenkontext(
            permissions,
            params.vorname,
            params.familienname,
            params.organisationId,
            params.rolleId,
            params.personalnummer || undefined,
            params.befristung || undefined,
        );

        if (savedPersonWithPersonenkontext instanceof PersonenkontextSpecificationError) {
            throw savedPersonWithPersonenkontext;
        }
        if (savedPersonWithPersonenkontext instanceof PersonenkontexteUpdateError) {
            throw savedPersonWithPersonenkontext;
        }

        if (savedPersonWithPersonenkontext instanceof DuplicatePersonalnummerError) {
            throw savedPersonWithPersonenkontext;
        }

        if (savedPersonWithPersonenkontext instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(savedPersonWithPersonenkontext),
            );
        }

        return new DBiamPersonResponse(
            savedPersonWithPersonenkontext.person,
            savedPersonWithPersonenkontext.personenkontext,
        );
    }
}
