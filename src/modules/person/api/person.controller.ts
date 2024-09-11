import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseFilters,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiAcceptedResponse,
    ApiBadGatewayResponse,
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOAuth2,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { ApiOkResponsePaginated, Paged, PagedResponse, PagingHeadersObject } from '../../../shared/paging/index.js';
import { ResultInterceptor } from '../../../shared/util/result-interceptor.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonenkontextBodyParams } from '../../personenkontext/api/param/create-personenkontext.body.params.js';
import { CreatePersonenkontextDto } from '../../personenkontext/api/create-personenkontext.dto.js';
import { CreatedPersonenkontextDto } from '../../personenkontext/api/created-personenkontext.dto.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { PersonenQueryParams } from './personen-query.param.js';
import { PersonenkontextQueryParams } from '../../personenkontext/api/param/personenkontext-query.params.js';
import { PersonenkontextResponse } from '../../personenkontext/api/response/personenkontext.response.js';
import { PersonenkontextUc } from '../../personenkontext/api/personenkontext.uc.js';
import { UpdatePersonBodyParams } from './update-person.body.params.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { DomainError, EntityNotFoundError } from '../../../shared/error/index.js';
import { LockInfo, Person } from '../domain/person.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonScope } from '../persistence/person.scope.js';
import { ScopeOrder } from '../../../shared/persistence/index.js';
import { PersonFactory } from '../domain/person.factory.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { Permissions } from '../../authentication/api/permissions.decorator.js';
import { OrganisationID } from '../../../shared/types/index.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { DataConfig, ServerConfig } from '../../../shared/config/index.js';
import { ConfigService } from '@nestjs/config';
import { AuthenticationExceptionFilter } from '../../authentication/api/authentication-exception-filter.js';
import { PersonDomainError } from '../domain/person-domain.error.js';
import { PersonExceptionFilter } from './person-exception-filter.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { PersonenkontextService } from '../../personenkontext/domain/personenkontext.service.js';
import { PersonApiMapper } from '../mapper/person-api.mapper.js';
import { KeycloakUserService } from '../../keycloak-administration/index.js';
import { LockUserBodyParams } from './lock-user.body.params.js';
import { PersonLockResponse } from './person-lock.response.js';
import { NotFoundOrNoPermissionError } from '../domain/person-not-found-or-no-permission.error.js';
import { DownstreamKeycloakError } from '../domain/person-keycloak.error.js';
import { PersonDeleteService } from '../person-deletion/person-delete.service.js';

@UseFilters(SchulConnexValidationErrorFilter, new AuthenticationExceptionFilter(), new PersonExceptionFilter())
@ApiTags('personen')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'personen' })
export class PersonController {
    public readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly personenkontextUc: PersonenkontextUc,
        private readonly personRepository: PersonRepository,
        private readonly personFactory: PersonFactory,
        private readonly personenkontextService: PersonenkontextService,
        private readonly personDeleteService: PersonDeleteService,
        private keycloakUserService: KeycloakUserService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
        config: ConfigService<ServerConfig>,
        private readonly personApiMapper: PersonApiMapper,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ description: 'The person was successfully created.', type: PersonendatensatzResponse })
    @ApiBadRequestResponse({ description: 'A username was given. Creation with username is not supported.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the person.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the person.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to create the person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the person.' })
    public async createPerson(
        @Body() params: CreatePersonBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonendatensatzResponse> {
        // Find all organisations where user has permission
        const isMigrationCall: boolean = !(!params.hashedPassword && !params.username);
        let organisationIDs: OrganisationID[];

        if (isMigrationCall === true) {
            organisationIDs = await permissions.getOrgIdsWithSystemrecht(
                [RollenSystemRecht.MIGRATION_DURCHFUEHREN],
                true,
            );
        } else {
            organisationIDs = await permissions.getOrgIdsWithSystemrecht([RollenSystemRecht.PERSONEN_VERWALTEN], true);
        }
        if (organisationIDs.length < 1) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(new EntityNotFoundError('Person')),
            );
        }
        const person: Person<false> | DomainError = await this.personFactory.createNew({
            vorname: params.name.vorname,
            familienname: params.name.familienname,
            initialenFamilienname: params.name.initialenfamilienname,
            initialenVorname: params.name.initialenvorname,
            rufname: params.name.rufname,
            nameTitel: params.name.titel,
            nameAnrede: params.name.anrede,
            namePraefix: params.name.namenspraefix,
            nameSuffix: params.name.namenssuffix,
            nameSortierindex: params.name.sortierindex,
            auskunftssperre: params.auskunftssperre,
            geburtsdatum: params.geburt?.datum,
            geburtsort: params.geburt?.geburtsort,
            username: params.username,
            personalnummer: params.personalnummer,
            ...params,
        });
        if (person instanceof DomainError) {
            if (person instanceof PersonDomainError) {
                throw person;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(person),
            );
        }

        const result: Person<true> | DomainError = await this.personRepository.create(person, params.hashedPassword);
        if (result instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result),
            );
        }

        return new PersonendatensatzResponse(result, isMigrationCall === true ? false : true);
    }

    @Delete(':personId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse({
        description: 'The person and all their kontexte were successfully deleted.',
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The person was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async deletePersonById(
        @Param() params: PersonByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<void> {
        const response: Result<void, DomainError> = await this.personDeleteService.deletePerson(
            params.personId,
            permissions,
        );
        // Throw an HTTP exception if the delete response is an error
        if (!response.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(response.error),
            );
        }
    }

    @Get(':personId')
    @ApiOkResponse({ description: 'The person was successfully returned.', type: PersonendatensatzResponse })
    @ApiBadRequestResponse({ description: 'Person ID is required' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the person.' })
    @ApiNotFoundResponse({ description: 'The person does not exist or insufficient permissions.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the person.' })
    public async findPersonById(
        @Param() params: PersonByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonendatensatzResponse> {
        //check that logged-in user is allowed to update person
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            params.personId,
            permissions,
        );
        if (!personResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', params.personId),
                ),
            );
        }

        const response: PersonendatensatzResponse = new PersonendatensatzResponse(personResult.value, false);
        return response;
    }

    /**
     * @deprecated This endpoint is no longer used.
     */
    @Post(':personId/personenkontexte')
    @HttpCode(200)
    @ApiOkResponse({ description: 'The personenkontext was successfully created.' })
    @ApiBadRequestResponse({ description: 'The personenkontext already exists.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the personenkontext.' })
    @ApiForbiddenResponse({ description: 'Not permitted to create the personenkontext.' })
    @ApiNotFoundResponse({ description: 'Insufficient permissions to create personenkontext for person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the personenkontext.' })
    public async createPersonenkontext(
        @Param() pathParams: PersonByIdParams,
        @Body() bodyParams: CreatePersonenkontextBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonenkontextResponse> {
        const personenkontextDto: CreatePersonenkontextDto = this.mapper.map(
            bodyParams,
            CreatePersonenkontextBodyParams,
            CreatePersonenkontextDto,
        );
        //check that logged-in user is allowed to update person
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            pathParams.personId,
            permissions,
        );
        if (!personResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', pathParams.personId),
                ),
            );
        }
        personenkontextDto.personId = personResult.value.id;

        const result: CreatedPersonenkontextDto | SchulConnexError =
            await this.personenkontextUc.createPersonenkontext(personenkontextDto);

        if (result instanceof SchulConnexError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(result);
        }

        return this.mapper.map(result, CreatedPersonenkontextDto, PersonenkontextResponse);
    }

    @Get(':personId/personenkontexte')
    @ApiOkResponsePaginated(PersonenkontextResponse, {
        description: 'The personenkontexte were successfully pulled.',
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get personenkontexte.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get personenkontexte.' })
    @ApiNotFoundResponse({ description: 'No personenkontexte were found.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all personenkontexte.' })
    public async findPersonenkontexte(
        @Param() pathParams: PersonByIdParams,
        @Query() queryParams: PersonenkontextQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PagedResponse<PersonenkontextResponse>> {
        // check that logged-in user is allowed to update person
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            pathParams.personId,
            permissions,
        );
        if (!personResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', pathParams.personId),
                ),
            );
        }

        const updatedQueryParams: PersonenkontextQueryParams = { ...queryParams, personId: personResult.value.id };
        // orgnisationID is undefined
        const personenkontexts: Paged<Personenkontext<true>> =
            await this.personenkontextService.findAllPersonenkontexte(
                updatedQueryParams,
                undefined,
                updatedQueryParams.offset,
                updatedQueryParams.limit,
            );

        const responseItems: PersonenkontextResponse[] = await Promise.all(
            personenkontexts.items.map(async (item: Personenkontext<true>) =>
                this.personApiMapper.mapToPersonenkontextResponse(item),
            ),
        );

        return new PagedResponse({
            items: responseItems,
            offset: personenkontexts.offset,
            limit: personenkontexts.limit,
            total: personenkontexts.total,
        });
    }

    @Get()
    @ApiOkResponse({
        description:
            'The persons were successfully returned. WARNING: This endpoint returns all persons as default when no paging parameters were set.',
        type: [PersonendatensatzResponse],
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get persons.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get persons.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting all persons.' })
    public async findPersons(
        @Query() queryParams: PersonenQueryParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PagedResponse<PersonendatensatzResponse>> {
        // Find all organisations where user has permission
        let organisationIDs: OrganisationID[] | undefined = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        // Check if user has permission on root organisation
        if (organisationIDs?.includes(this.ROOT_ORGANISATION_ID)) {
            organisationIDs = undefined;
        }

        // Find all Personen on child-orgas (+root orgas)
        const scope: PersonScope = new PersonScope()
            .findBy({ organisationen: organisationIDs })
            .sortBy('vorname', ScopeOrder.ASC)
            .paged(queryParams.offset, queryParams.limit);

        const [persons, total]: Counted<Person<true>> = await this.personRepository.findBy(scope);

        const response: PagedResponse<PersonendatensatzResponse> = new PagedResponse({
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? total,
            total: total,
            items: persons.map((person: Person<true>) => new PersonendatensatzResponse(person, false)),
        });

        return response;
    }

    @Put(':personId')
    @ApiOkResponse({
        description: 'The person was successfully updated.',
        type: PersonendatensatzResponse,
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The person was not found or insufficient permissions to update person.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async updatePerson(
        @Param() params: PersonByIdParams,
        @Body() body: UpdatePersonBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonendatensatzResponse> {
        //check that logged-in user is allowed to update person
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            params.personId,
            permissions,
        );
        if (!personResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', params.personId),
                ),
            );
        }
        const updateResult: void | DomainError = personResult.value.update(
            body.revision,
            body.name.familienname,
            body.name.vorname,
            body.referrer,
            body.stammorganisation,
            body.name.initialenfamilienname,
            body.name.initialenvorname,
            body.name.rufname,
            body.name.titel,
            body.name.anrede,
            body.name.namenspraefix,
            body.name.namenssuffix,
            body.name.sortierindex,
            body.geburt?.datum,
            body.geburt?.geburtsort,
            body.geschlecht,
            body.lokalisierung,
            body.vertrauensstufe,
            body.auskunftssperre,
        );
        if (updateResult instanceof DomainError) {
            if (updateResult instanceof PersonDomainError) {
                throw updateResult;
            }

            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(updateResult),
            );
        }
        await this.personRepository.update(personResult.value);

        return new PersonendatensatzResponse(personResult.value, false);
    }

    @Patch(':personId/password')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiAcceptedResponse({ description: 'Password for person was successfully reset.', type: String })
    @ApiNotFoundResponse({ description: 'The person does not exist or insufficient permissions to update person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
    @UseInterceptors(ResultInterceptor)
    public async resetPasswordByPersonId(
        @Param() params: PersonByIdParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<Result<string>> {
        //check that logged-in user is allowed to update person
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            params.personId,
            permissions,
        );
        if (!personResult.ok) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', params.personId),
                ),
            );
        }
        personResult.value.resetPassword();
        const saveResult: Person<true> | DomainError = await this.personRepository.update(personResult.value);

        if (saveResult instanceof DomainError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(saveResult),
            );
        }

        return { ok: true, value: personResult.value.newPassword! };
    }

    @Put(':personId/lock-user')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOkResponse({ description: 'User has been successfully updated.', type: PersonLockResponse })
    @ApiNotFoundResponse({ description: 'The person was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    @ApiBadGatewayResponse({ description: 'A downstream server returned an error.' })
    public async lockPerson(
        @Param('personId') personId: string,
        @Body() lockUserBodyParams: LockUserBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<PersonLockResponse> {
        const personResult: Result<Person<true>> = await this.personRepository.getPersonIfAllowed(
            personId,
            permissions,
        );

        if (!personResult.ok) {
            throw new NotFoundOrNoPermissionError(personId);
        }

        if (!personResult.value?.keycloakUserId) {
            throw new PersonDomainError(`Person with id ${personId} has no keycloak id`, personId);
        }

        const lockInfo: LockInfo = {
            lock_locked_from: lockUserBodyParams.locked_from,
            lock_timestamp: new Date().toISOString(),
        };

        const result: Result<void, DomainError> = await this.keycloakUserService.updateKeycloakUserStatus(
            personResult.value.keycloakUserId,
            !lockUserBodyParams.lock,
            lockInfo,
        );
        if (!result.ok) {
            throw new DownstreamKeycloakError(result.error.message, personId, [result.error.details]);
        }
        return new PersonLockResponse(`User has been successfully ${lockUserBodyParams.lock ? '' : 'un'}locked.`);
    }
}
