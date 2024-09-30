import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
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

import { DomainError } from '../../../shared/error/domain.error.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { OrganisationService } from '../../organisation/domain/organisation.service.js';
import { Rolle } from '../domain/rolle.js';
import { RolleRepo } from '../repo/rolle.repo.js';
import { CreateRolleBodyParams } from './create-rolle.body.params.js';
import { RolleResponse } from './rolle.response.js';
import { RolleFactory } from '../domain/rolle.factory.js';
import { AddSystemrechtBodyParams } from './add-systemrecht.body.params.js';
import { FindRolleByIdParams } from './find-rolle-by-id.params.js';
import { AddSystemrechtError } from './add-systemrecht.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { RolleServiceProviderQueryParams } from './rolle-service-provider.query.params.js';
import { RolleServiceProviderResponse } from './rolle-service-provider.response.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { ServiceProvider } from '../../service-provider/domain/service-provider.js';
import { RolleWithServiceProvidersResponse } from './rolle-with-serviceprovider.response.js';
import { RolleNameQueryParams } from './rolle-name-query.param.js';
import { ServiceProviderResponse } from '../../service-provider/api/service-provider.response.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { RolleExceptionFilter } from './rolle-exception-filter.js';
import { Paged, PagedResponse, PagingHeadersObject } from '../../../shared/paging/index.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { UpdateRolleBodyParams } from './update-rolle.body.params.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { RolleDomainError } from '../domain/rolle-domain.error.js';
import { AuthenticationExceptionFilter } from '../../authentication/api/authentication-exception-filter.js';
import { DbiamRolleError } from './dbiam-rolle.error.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';

@UseFilters(new SchulConnexValidationErrorFilter(), new RolleExceptionFilter(), new AuthenticationExceptionFilter())
@ApiTags('rolle')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'rolle' })
export class RolleController {
    public constructor(
        private readonly rolleRepo: RolleRepo,
        private readonly rolleFactory: RolleFactory,
        private readonly orgService: OrganisationService,
        private readonly serviceProviderRepo: ServiceProviderRepo,
        private readonly dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly organisationRepository: OrganisationRepository,
    ) {}

    @Get()
    @ApiOperation({ description: 'List all rollen.' })
    @ApiOkResponse({
        description: 'The rollen were successfully returned',
        type: [RolleWithServiceProvidersResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get rollen.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get rollen.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all rollen.' })
    public async findRollen(
        @Query() queryParams: RolleNameQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PagedResponse<RolleWithServiceProvidersResponse>> {
        const [rollen, total]: [Option<Rolle<true>[]>, number] = await this.rolleRepo.findRollenAuthorized(
            permissions,
            false,
            queryParams.searchStr,
            queryParams.limit,
            queryParams.offset,
        );

        if (!rollen || rollen.length === 0) {
            const pagedRolleWithServiceProvidersResponse: Paged<RolleWithServiceProvidersResponse> = {
                total: 0,
                offset: 0,
                limit: queryParams.limit ?? 0,
                items: [],
            };
            return new PagedResponse(pagedRolleWithServiceProvidersResponse);
        }
        const administeredBySchulstrukturknotenIds: string[] = rollen.map(
            (r: Rolle<true>) => r.administeredBySchulstrukturknoten,
        );
        const administeredOrganisations: Map<string, Organisation<true>> = await this.organisationRepository.findByIds(
            administeredBySchulstrukturknotenIds,
        );
        const serviceProviders: ServiceProvider<true>[] = await this.serviceProviderRepo.find();
        const rollenWithServiceProvidersResponses: RolleWithServiceProvidersResponse[] = rollen.map(
            (r: Rolle<true>) => {
                const sps: ServiceProvider<true>[] = r.serviceProviderIds
                    .map((id: string) => serviceProviders.find((sp: ServiceProvider<true>) => sp.id === id))
                    .filter(Boolean) as ServiceProvider<true>[];

                const administeredBySchulstrukturknoten: Organisation<true> | undefined = administeredOrganisations.get(
                    r.administeredBySchulstrukturknoten,
                );

                return new RolleWithServiceProvidersResponse(
                    r,
                    sps,
                    administeredBySchulstrukturknoten?.name,
                    administeredBySchulstrukturknoten?.kennung,
                );
            },
        );
        const pagedRolleWithServiceProvidersResponse: Paged<RolleWithServiceProvidersResponse> = {
            total: total,
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? rollenWithServiceProvidersResponses.length,
            items: rollenWithServiceProvidersResponses,
        };

        return new PagedResponse(pagedRolleWithServiceProvidersResponse);
    }

    @Get(':rolleId')
    @ApiOperation({ description: 'Get rolle by id.' })
    @ApiOkResponse({
        description: 'The rolle was successfully returned.',
        type: RolleWithServiceProvidersResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get rolle by id.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get rolle by id.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting rolle by id.' })
    public async findRolleByIdWithServiceProviders(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<RolleWithServiceProvidersResponse> {
        const rolleResult: Result<Rolle<true>> = await this.rolleRepo.findByIdAuthorized(
            findRolleByIdParams.rolleId,
            permissions,
        );
        if (!rolleResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Rolle', findRolleByIdParams.rolleId),
                ),
            );
        }

        return this.returnRolleWithServiceProvidersResponse(rolleResult.value);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ description: 'Create a new rolle.' })
    @ApiCreatedResponse({ description: 'The rolle was successfully created.', type: RolleResponse })
    @ApiBadRequestResponse({ description: 'The input was not valid.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the rolle.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the rolle.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the rolle.' })
    public async createRolle(@Body() params: CreateRolleBodyParams): Promise<RolleResponse> {
        const orgResult: Result<OrganisationDo<true>, DomainError> = await this.orgService.findOrganisationById(
            params.administeredBySchulstrukturknoten,
        );

        if (!orgResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(orgResult.error),
            );
        }

        const rolle: DomainError | Rolle<false> = this.rolleFactory.createNew(
            params.name,
            params.administeredBySchulstrukturknoten,
            params.rollenart,
            params.merkmale,
            params.systemrechte,
            [],
            [],
            false,
        );

        if (rolle instanceof DomainError) {
            throw rolle;
        }

        const result: Rolle<true> = await this.rolleRepo.save(rolle);

        return new RolleResponse(result);
    }

    @Patch(':rolleId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ description: 'Add systemrecht to a rolle.' })
    @ApiOkResponse({ description: 'The systemrecht was successfully added to rolle.' })
    @ApiBadRequestResponse({ description: 'The input was not valid.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the rolle.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the rolle.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while adding systemrecht to rolle.',
    })
    public async addSystemRecht(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Body() addSystemrechtBodyParams: AddSystemrechtBodyParams,
    ): Promise<void> {
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(findRolleByIdParams.rolleId);
        if (rolle) {
            rolle.addSystemRecht(addSystemrechtBodyParams.systemRecht);
            await this.rolleRepo.save(rolle);
        } else {
            throw new AddSystemrechtError(); //hide that rolle is not found
        }
    }

    @Get(':rolleId/serviceProviders')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ description: 'Get service-providers for a rolle by its id.' })
    @ApiOkResponse({ description: 'Returns a list of service-provider ids.', type: RolleServiceProviderResponse })
    @ApiNotFoundResponse({ description: 'The rolle does not exist.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to retrieve service-providers for rolle.' })
    public async getRolleServiceProviderIds(
        @Param() findRolleByIdParams: FindRolleByIdParams,
    ): Promise<RolleServiceProviderResponse> {
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(findRolleByIdParams.rolleId);
        if (!rolle) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(new EntityNotFoundError()),
            );
        }
        return {
            serviceProviderIds: rolle.serviceProviderIds,
        };
    }

    @Put(':rolleId/serviceProviders')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ description: 'Add a service-provider to a rolle by id.' })
    @ApiOkResponse({ description: 'Adding service-provider finished successfully.', type: [ServiceProviderResponse] })
    @ApiNotFoundResponse({ description: 'The rolle or the service-provider to add does not exist.' })
    @ApiBadRequestResponse({ description: 'The service-provider is already attached to rolle.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to retrieve service-providers for rolle.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error, the service-provider may could not be found after attaching to rolle.',
    })
    public async updateServiceProvidersById(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Body() spBodyParams: RolleServiceProviderQueryParams,
    ): Promise<ServiceProviderResponse[]> {
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(findRolleByIdParams.rolleId);
        if (!rolle) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Rolle', findRolleByIdParams.rolleId),
                ),
            );
        }
        const result: void | DomainError = await rolle.updateServiceProviders(spBodyParams.serviceProviderIds);
        if (result instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }
        await this.rolleRepo.save(rolle);

        const serviceProviderMap: Map<string, ServiceProvider<true>> = await this.serviceProviderRepo.findByIds(
            spBodyParams.serviceProviderIds,
        );

        // Check if all provided IDs are in the map
        const missingServiceProviderIds: string[] = spBodyParams.serviceProviderIds.filter(
            (id: string) => !serviceProviderMap.has(id),
        );

        if (missingServiceProviderIds.length > 0) {
            // If some IDs are missing, throw an error with details about the missing IDs
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                new SchulConnexError({
                    code: 500,
                    subcode: '00',
                    titel: 'Service-Provider nicht gefunden',
                    beschreibung: `Die folgenden Service-Provider-IDs konnten nicht gefunden werden: ${missingServiceProviderIds.join(', ')}`,
                }),
            );
        }
        // Convert the Map of service providers to an array of ServiceProviderResponse objects
        const serviceProviderResponses: ServiceProviderResponse[] = Array.from(serviceProviderMap.values()).map(
            (serviceProvider: ServiceProvider<true>) => new ServiceProviderResponse(serviceProvider),
        );

        // Return the array of ServiceProviderResponse objects
        return serviceProviderResponses;
    }

    @Delete(':rolleId/serviceProviders')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ description: 'Remove a service-provider from a rolle by id.' })
    @ApiOkResponse({ description: 'Removing service-provider finished successfully.' })
    @ApiNotFoundResponse({ description: 'The rolle or the service-provider that should be removed does not exist.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to retrieve service-providers for rolle.' })
    public async removeServiceProviderById(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Query() spBodyParams: RolleServiceProviderQueryParams,
    ): Promise<void> {
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(findRolleByIdParams.rolleId);

        if (!rolle) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Rolle', findRolleByIdParams.rolleId),
                ),
            );
        }
        const result: void | DomainError = rolle.detatchServiceProvider(spBodyParams.serviceProviderIds);
        if (result instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }
        await this.rolleRepo.save(rolle);
    }

    @Put(':rolleId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ description: 'Update rolle.' })
    @ApiOkResponse({
        description: 'The rolle was successfully updated.',
        type: RolleWithServiceProvidersResponse,
    })
    @ApiBadRequestResponse({ description: 'The input was not valid.', type: DbiamRolleError })
    @ApiUnauthorizedResponse({ description: 'Not authorized to update the rolle.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to update the rolle.' })
    @ApiInternalServerErrorResponse({
        description: 'Internal server error while updating the rolle.',
    })
    public async updateRolle(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Body() params: UpdateRolleBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<RolleWithServiceProvidersResponse> {
        const isAlreadyAssigned: boolean = await this.dBiamPersonenkontextRepo.isRolleAlreadyAssigned(
            findRolleByIdParams.rolleId,
        );
        const result: Rolle<true> | DomainError = await this.rolleRepo.updateRolleAuthorized(
            findRolleByIdParams.rolleId,
            params.name,
            params.merkmale,
            params.systemrechte,
            params.serviceProviderIds,
            isAlreadyAssigned,
            permissions,
        );

        if (result instanceof DomainError) {
            if (result instanceof RolleDomainError) {
                throw result;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }

        return this.returnRolleWithServiceProvidersResponse(result);
    }

    @Delete(':rolleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ description: 'Delete a role by id.' })
    @ApiNoContentResponse({ description: 'Role was deleted successfully.' })
    @ApiBadRequestResponse({ description: 'The input was not valid.', type: DbiamRolleError })
    @ApiNotFoundResponse({ description: 'The rolle that should be deleted does not exist.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to delete the role.' })
    public async deleteRolle(
        @Param() findRolleByIdParams: FindRolleByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<void> {
        const result: Option<DomainError> = await this.rolleRepo.deleteAuthorized(
            findRolleByIdParams.rolleId,
            permissions,
        );
        if (result instanceof DomainError) {
            if (result instanceof RolleDomainError) {
                throw result;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }
    }

    private async returnRolleWithServiceProvidersResponse(
        rolle: Rolle<true>,
    ): Promise<RolleWithServiceProvidersResponse> {
        const serviceProviders: ServiceProvider<true>[] = await this.serviceProviderRepo.find();

        const rolleServiceProviders: ServiceProvider<true>[] = rolle.serviceProviderIds
            .map((id: string) => serviceProviders.find((sp: ServiceProvider<true>) => sp.id === id))
            .filter(Boolean) as ServiceProvider<true>[];

        return new RolleWithServiceProvidersResponse(rolle, rolleServiceProviders);
    }
}
