import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseFilters,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { Paged, PagingHeadersObject } from '../../../shared/paging/index.js';
import { PagedResponse } from '../../../shared/paging/paged.response.js';
import { CreateOrganisationBodyParams } from './create-organisation.body.params.js';
import { FindOrganisationQueryParams } from './find-organisation-query.param.js';
import { OrganisationByIdParams } from './organisation-by-id.params.js';
import { UpdateOrganisationBodyParams } from './update-organisation.body.params.js';
import { OrganisationByIdBodyParams } from './organisation-by-id.body.params.js';
import { OrganisationRepository } from '../persistence/organisation.repository.js';
import { OrganisationScope } from '../persistence/organisation.scope.js';
import { Organisation } from '../domain/organisation.js';
import { ScopeOperator } from '../../../shared/persistence/index.js';
import { OrganisationResponse } from './organisation.response.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { OrganisationRootChildrenResponse } from './organisation.root-children.response.js';
import { DomainError, EntityNotFoundError } from '../../../shared/error/index.js';
import { DbiamOrganisationError } from './dbiam-organisation.error.js';
import { OrganisationExceptionFilter } from './organisation-exception-filter.js';
import { OrganisationSpecificationError } from '../specification/error/organisation-specification.error.js';
import { OrganisationByNameQueryParams } from './organisation-by-name.query.js';
import { OrganisationsTyp } from '../domain/organisation.enums.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { OrganisationService } from '../domain/organisation.service.js';
import { DataConfig } from '../../../shared/config/data.config.js';
import { AuthenticationExceptionFilter } from '../../authentication/api/authentication-exception-filter.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { OrganisationIstBereitsZugewiesenError } from '../domain/organisation-ist-bereits-zugewiesen.error.js';
import { OrganisationByNameBodyParams } from './organisation-by-name.body.params.js';
import { OrganisationResponseLegacy } from './organisation.response.legacy.js';
import { ParentOrganisationsByIdsBodyParams } from './parent-organisations-by-ids.body.params.js';
import { ParentOrganisationenResponse } from './organisation.parents.response.js';

@UseFilters(
    new SchulConnexValidationErrorFilter(),
    new OrganisationExceptionFilter(),
    new AuthenticationExceptionFilter(),
)
@ApiTags('organisationen')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'organisationen' })
export class OrganisationController {
    public constructor(
        private readonly organisationRepository: OrganisationRepository,
        private readonly dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly config: ConfigService<ServerConfig>,
        private readonly organisationService: OrganisationService,
    ) {}

    @Post()
    @ApiCreatedResponse({ description: 'The organisation was successfully created.', type: OrganisationResponse })
    @ApiBadRequestResponse({ description: 'The organisation already exists.', type: DbiamOrganisationError })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the organisation.' })
    @ApiForbiddenResponse({ description: 'Not permitted to create the organisation.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the organisation.' })
    public async createOrganisation(@Body() params: CreateOrganisationBodyParams): Promise<OrganisationResponse> {
        const ROOT_ORGANISATION_ID: string = this.config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;

        const organisation: Organisation<false> | DomainError = Organisation.createNew(
            params.administriertVon ?? ROOT_ORGANISATION_ID,
            params.zugehoerigZu ?? ROOT_ORGANISATION_ID,
            params.kennung,
            params.name,
            params.namensergaenzung,
            params.kuerzel,
            params.typ,
            params.traegerschaft,
        );
        if (organisation instanceof DomainError) {
            throw organisation;
        }
        const result: Result<Organisation<true>, DomainError> = await this.organisationService.createOrganisation(
            organisation,
        );
        if (!result.ok) {
            if (result.error instanceof OrganisationSpecificationError) {
                throw result.error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
            );
        }

        return new OrganisationResponse(result.value);
    }

    @Put(':organisationId')
    @ApiOkResponse({
        description: 'The organisation was successfully updated.',
        type: OrganisationResponse,
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.', type: DbiamOrganisationError })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The organisation was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async updateOrganisation(
        @Param() params: OrganisationByIdParams,
        @Body() body: UpdateOrganisationBodyParams,
    ): Promise<OrganisationResponse> {
        const existingOrganisation: Option<Organisation<true>> = await this.organisationRepository.findById(
            params.organisationId,
        );

        if (!existingOrganisation) {
            throw new NotFoundException(`Organisation with ID ${params.organisationId} not found`);
        }

        existingOrganisation.id = params.organisationId;
        existingOrganisation.administriertVon = body.administriertVon;
        existingOrganisation.zugehoerigZu = body.zugehoerigZu;
        existingOrganisation.kennung = body.kennung;
        existingOrganisation.name = body.name;
        existingOrganisation.namensergaenzung = body.namensergaenzung;
        existingOrganisation.kuerzel = body.kuerzel;
        existingOrganisation.typ = body.typ;
        existingOrganisation.traegerschaft = body.traegerschaft;
        existingOrganisation.updatedAt = new Date();

        const result: Result<Organisation<true>, DomainError> = await this.organisationService.updateOrganisation(
            existingOrganisation,
        );

        if (result.ok) {
            return new OrganisationResponse(result.value);
        } else {
            if (result.error instanceof OrganisationSpecificationError) {
                throw result.error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
            );
        }
    }

    @Get('root')
    @ApiOkResponse({ description: 'The root organization was successfully retrieved.', type: OrganisationResponse })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the root organization.' })
    @ApiNotFoundResponse({ description: 'The root organization does not exist.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the root organization.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the root organization.' })
    public async getRootOrganisation(): Promise<OrganisationResponse> {
        const ROOT_ORGANISATION_ID: string = this.config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
        const result: Result<Organisation<true>, DomainError> = await this.organisationService.findOrganisationById(
            ROOT_ORGANISATION_ID,
        );

        if (result.ok) {
            return new OrganisationResponse(result.value);
        }

        throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
            SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
        );
    }

    @Get('root/children')
    @ApiOkResponse({
        description: 'The root organizations were successfully pulled.',
        type: OrganisationRootChildrenResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the organizations.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the organizations.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the organization.' })
    public async getRootChildren(): Promise<OrganisationRootChildrenResponse> {
        const [oeffentlich, ersatz]: [Organisation<true> | undefined, Organisation<true> | undefined] =
            await this.organisationRepository.findRootDirectChildren();

        if (!oeffentlich || !ersatz) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Organisation', `${!oeffentlich && 'Oeffentlich'} ${!ersatz && 'Ersatz'}`),
                ),
            );
        }

        return new OrganisationRootChildrenResponse(oeffentlich, ersatz);
    }

    @Post('parents-by-ids')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({
        description: 'The parent organizations were successfully pulled.',
        type: ParentOrganisationenResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the organizations.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the organizations.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the organization.' })
    public async getParentsByIds(
        @Body() body: ParentOrganisationsByIdsBodyParams,
    ): Promise<ParentOrganisationenResponse> {
        const organisationen: Organisation<true>[] = await this.organisationRepository.findParentOrgasForIds(
            body.organisationIds,
        );
        return new ParentOrganisationenResponse(organisationen);
    }

    @Get(':organisationId')
    @ApiOkResponse({ description: 'The organization was successfully pulled.', type: OrganisationResponse })
    @ApiBadRequestResponse({ description: 'Organization ID is required' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the organization.' })
    @ApiNotFoundResponse({ description: 'The organization does not exist.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the organization.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the organization.' })
    public async findOrganisationById(@Param() params: OrganisationByIdParams): Promise<OrganisationResponse> {
        const result: Result<Organisation<true>, DomainError> = await this.organisationService.findOrganisationById(
            params.organisationId,
        );

        if (result.ok) {
            return new OrganisationResponse(result.value);
        } else {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error),
            );
        }
    }

    @Get()
    @ApiOkResponse({
        description: 'The organizations were successfully returned.',
        type: [OrganisationResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get organizations.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get organizations.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all organizations.' })
    public async findOrganizations(
        @Query() queryParams: FindOrganisationQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PagedResponse<OrganisationResponse>> {
        const validOrgaIDs: OrganisationID[] = await permissions.getOrgIdsWithSystemrecht(
            queryParams.systemrechte,
            true,
        );

        const scope: OrganisationScope = new OrganisationScope();

        // Define scope based on the organisation type
        if (queryParams.typ === OrganisationsTyp.KLASSE) {
            scope
                .findBy({
                    kennung: queryParams.kennung,
                    name: queryParams.name,
                    typ: queryParams.typ,
                })
                .setScopeWhereOperator(ScopeOperator.AND)
                .findByAdministriertVonArray(queryParams.administriertVon)
                .searchStringAdministriertVon(queryParams.searchString)
                .excludeTyp(queryParams.excludeTyp)
                .byIDs(validOrgaIDs)
                .paged(queryParams.offset, queryParams.limit);
        } else {
            scope
                .findBy({
                    kennung: queryParams.kennung,
                    name: queryParams.name,
                    typ: queryParams.typ,
                })
                .setScopeWhereOperator(ScopeOperator.AND)
                .findByAdministriertVonArray(queryParams.administriertVon)
                .searchString(queryParams.searchString)
                .excludeTyp(queryParams.excludeTyp)
                .byIDs(validOrgaIDs)
                .paged(queryParams.offset, queryParams.limit);
        }

        const [organisations, total]: Counted<Organisation<true>> = await this.organisationRepository.findBy(scope);

        // Create a Map from the existing organisations
        const organisationMap: Map<string, Organisation<true>> = new Map(
            organisations.map((org: Organisation<true>) => [org.id, org]),
        );

        // Fetch and merge selected organisations
        if (queryParams.organisationIds?.length) {
            const selectedOrganisationMap: Map<
                string,
                Organisation<true>
            > = await this.organisationRepository.findByIds(queryParams.organisationIds);

            selectedOrganisationMap.forEach((organisation: Organisation<true>, id: string) => {
                organisationMap.set(id, organisation);
            });
        }

        // Convert the map to an array and handle pagination
        const mergedOrganisations: Organisation<true>[] = Array.from(organisationMap.values());

        const organisationResponses: OrganisationResponse[] = mergedOrganisations.map(
            (organisation: Organisation<true>) => {
                return new OrganisationResponse(organisation);
            },
        );

        const pagedOrganisationResponse: Paged<OrganisationResponse> = {
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? total,
            total: total,
            pageTotal: organisationResponses.length, // Number of items in the current page
            items: organisationResponses, // Paginated items
        };

        return new PagedResponse(pagedOrganisationResponse);
    }

    @Get(':organisationId/administriert')
    @ApiOkResponse({
        description: 'The organizations were successfully returned.',
        type: [OrganisationResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get organizations.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get organizations.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all organizations.' })
    public async getAdministrierteOrganisationen(
        @Param() routeParams: OrganisationByIdParams,
        @Query() queryParams: OrganisationByNameQueryParams,
    ): Promise<PagedResponse<OrganisationResponse>> {
        const parentOrg: Result<Organisation<true>, DomainError> = await this.organisationService.findOrganisationById(
            routeParams.organisationId,
        );
        if (!parentOrg.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(parentOrg.error),
            );
        }

        const result: Paged<Organisation<true>> = await this.organisationService.findAllAdministriertVon(
            routeParams.organisationId,
            queryParams.searchFilter,
            queryParams.offset,
            queryParams.limit,
        );

        return new PagedResponse({
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            items: result.items.map((item: Organisation<true>) => new OrganisationResponse(item)),
            pageTotal: result.items.length,
        });
    }

    @Post(':organisationId/administriert')
    @ApiCreatedResponse({ description: 'The organisation was successfully updated.' })
    @ApiBadRequestResponse({ description: 'The organisation could not be modified.', type: DbiamOrganisationError })
    @ApiUnauthorizedResponse({ description: 'Not authorized to modify the organisation.' })
    @ApiForbiddenResponse({ description: 'Not permitted to modify the organisation.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while modifying the organisation.' })
    public async addAdministrierteOrganisation(
        @Param() params: OrganisationByIdParams,
        @Body() body: OrganisationByIdBodyParams,
    ): Promise<void> {
        const res: Result<void, OrganisationSpecificationError | DomainError> =
            await this.organisationService.setAdministriertVon(params.organisationId, body.organisationId);

        if (!res.ok) {
            // Avoid passing OrganisationSpecificationError to SchulConnexErrorMapper
            if (res.error instanceof OrganisationSpecificationError) {
                throw res.error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(res.error),
            );
        }
    }

    @Get(':organisationId/zugehoerig')
    @ApiOkResponse({
        description: 'The organizations were successfully returned.',
        type: [OrganisationResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get organizations.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get organizations.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all organizations.' })
    public async getZugehoerigeOrganisationen(
        @Param() params: OrganisationByIdParams,
    ): Promise<PagedResponse<OrganisationResponse>> {
        const parentOrg: Result<Organisation<true>, DomainError> = await this.organisationService.findOrganisationById(
            params.organisationId,
        );
        if (!parentOrg.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(parentOrg.error),
            );
        }

        const result: Paged<Organisation<true>> = await this.organisationService.findAllZugehoerigZu(
            params.organisationId,
        );

        const organisations: OrganisationResponse[] = result.items.map(
            (item: Organisation<true>) => new OrganisationResponse(item),
        );

        const response: PagedResponse<OrganisationResponse> = new PagedResponse({
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            items: organisations,
            pageTotal: organisations.length,
        });

        return response;
    }

    @Post(':organisationId/zugehoerig')
    @ApiCreatedResponse({ description: 'The organisation was successfully updated.' })
    @ApiBadRequestResponse({ description: 'The organisation could not be modified.', type: DbiamOrganisationError })
    @ApiUnauthorizedResponse({ description: 'Not authorized to modify the organisation.' })
    @ApiForbiddenResponse({ description: 'Not permitted to modify the organisation.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while modifying the organisation.' })
    public async addZugehoerigeOrganisation(
        @Param() params: OrganisationByIdParams,
        @Body() body: OrganisationByIdBodyParams,
    ): Promise<void> {
        const res: Result<void, DomainError> = await this.organisationService.setZugehoerigZu(
            params.organisationId,
            body.organisationId,
        );

        if (!res.ok) {
            // Avoid passing OrganisationSpecificationError to SchulConnexErrorMapper
            if (res.error instanceof OrganisationSpecificationError) {
                throw res.error;
            }
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(res.error),
            );
        }
    }

    @Delete(':organisationId/klasse')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ description: 'Delete an organisation of type Klasse by id.' })
    @ApiNoContentResponse({ description: 'The organisation was deleted successfully.' })
    @ApiBadRequestResponse({ description: 'The input was not valid.', type: DbiamOrganisationError })
    @ApiNotFoundResponse({ description: 'The organisation that should be deleted does not exist.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to delete the organisation.' })
    public async deleteKlasse(@Param() params: OrganisationByIdParams): Promise<void> {
        if (await this.dBiamPersonenkontextRepo.isOrganisationAlreadyAssigned(params.organisationId)) {
            throw new OrganisationIstBereitsZugewiesenError();
        }

        const result: Option<DomainError> = await this.organisationRepository.deleteKlasse(params.organisationId);
        if (result instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }
    }

    @Patch(':organisationId/name')
    @ApiOkResponse({
        description: 'The organizations were successfully updated.',
        type: OrganisationResponseLegacy,
        headers: PagingHeadersObject,
    })
    @ApiBadRequestResponse({ description: 'The organisation could not be modified.', type: DbiamOrganisationError })
    @ApiUnauthorizedResponse({ description: 'Not authorized to modify the organisation.' })
    @ApiForbiddenResponse({ description: 'Not permitted to modify the organisation.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while modifying the organisation.' })
    public async updateOrganisationName(
        @Param() params: OrganisationByIdParams,
        @Body() body: OrganisationByNameBodyParams,
    ): Promise<OrganisationResponse | DomainError> {
        const result: DomainError | Organisation<true> = await this.organisationRepository.updateKlassenname(
            params.organisationId,
            body.name,
        );

        if (result instanceof DomainError) {
            if (result instanceof OrganisationSpecificationError) {
                throw result;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }

        return new OrganisationResponse(result);
    }
}
