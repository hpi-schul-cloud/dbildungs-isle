import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOAuth2,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { ApiOkResponsePaginated, DisablePagingInterceptor, RawPagedResponse } from '../../../shared/paging/index.js';
import { PersonenQueryParams } from './personen-query.param.js';
import { ScopeOperator, ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { Person } from '../domain/person.js';
import { PersonScope } from '../persistence/person.scope.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { ConfigService } from '@nestjs/config';
import { DataConfig } from '../../../shared/config/data.config.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';

@UseFilters(SchulConnexValidationErrorFilter)
@ApiTags('personen-frontend')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'personen-frontend' })
export class PersonFrontendController {
    public readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly personRepository: PersonRepository,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    @Get()
    @DisablePagingInterceptor()
    @ApiOkResponsePaginated(PersonendatensatzResponse, {
        description:
            'The persons were successfully returned. WARNING: This endpoint returns all persons as default when no paging parameters were set.',
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get persons.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get persons.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all persons.' })
    public async findPersons(
        @Query() queryParams: PersonenQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<RawPagedResponse<PersonendatensatzResponse>> {
        // Find all organisations where user has permission
        let organisationIDs: OrganisationID[] | undefined = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        // Check if user has permission on root organisation
        if (organisationIDs?.includes(this.ROOT_ORGANISATION_ID)) {
            organisationIDs = undefined;
        }

        const scope: PersonScope = new PersonScope()
            .findBy({
                vorname: undefined,
                familienname: undefined,
                geburtsdatum: undefined,
                organisationen: organisationIDs,
            })
            .sortBy('vorname', ScopeOrder.ASC)
            .paged(queryParams.offset, queryParams.limit);

        if (queryParams.suchFilter) {
            scope.findBySearchString(queryParams.suchFilter).setScopeWhereOperator(ScopeOperator.AND);
        }

        const [persons, total]: Counted<Person<true>> = await this.personRepository.findBy(scope);

        const response: RawPagedResponse<PersonendatensatzResponse> = new RawPagedResponse({
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? total,
            total: total,
            items: persons.map((person: Person<true>) => new PersonendatensatzResponse(person, false)),
        });

        return response;
    }
}
