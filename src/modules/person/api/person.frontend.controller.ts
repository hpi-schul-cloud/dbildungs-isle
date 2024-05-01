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
import { ScopeOrder } from '../../../shared/persistence/scope.enums.js';
import { Person } from '../domain/person.js';
import { PersonScope } from '../persistence/person.scope.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonRepository } from '../persistence/person.repository.js';

@UseFilters(SchulConnexValidationErrorFilter)
@ApiTags('personen-frontend')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'personen-frontend' })
export class PersonFrontendController {
    public constructor(private readonly personRepository: PersonRepository) {}

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
    ): Promise<RawPagedResponse<PersonendatensatzResponse>> {
        const scope: PersonScope = new PersonScope()
            .findBy({
                vorname: undefined,
                familienname: undefined,
                geburtsdatum: undefined,
            })
            .sortBy('vorname', ScopeOrder.ASC)
            .paged(queryParams.offset, queryParams.limit);

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
