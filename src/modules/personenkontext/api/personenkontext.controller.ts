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
    Put,
    Query,
    UseFilters,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
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
import { Paged } from '../../../shared/paging/paged.js';
import { PagedResponse } from '../../../shared/paging/paged.response.js';
import { PagingHeadersObject } from '../../../shared/paging/paging.enums.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextByIdParams } from './find-personenkontext-by-id.params.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { PersonendatensatzDto } from '../../person/api/personendatensatz.dto.js';
import { PersonendatensatzResponseAutomapper } from '../../person/api/personendatensatz.response-automapper.js';
import { PersonenkontextQueryParams } from './personenkontext-query.params.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { PersonenkontextResponse } from './personenkontext.response.js';
import { PersonenkontextUc } from './personenkontext.uc.js';
import { PersonenkontextdatensatzResponse } from './personenkontextdatensatz.response.js';
import { UpdatePersonenkontextBodyParams } from './update-personenkontext.body.params.js';
import { UpdatePersonenkontextDto } from './update-personenkontext.dto.js';
import { DeleteRevisionBodyParams } from '../../person/api/delete-revision.body.params.js';
import { DeletePersonenkontextDto } from './delete-personkontext.dto.js';
import { SystemrechtResponse } from './personenkontext-systemrecht.response.js';
import { PersonByIdParams } from '../../person/api/person-by-id.param.js';
import { HatSystemrechtBodyParams } from './hat-systemrecht.body.params.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { EntityNotFoundError } from '../../../shared/error/index.js';
import { isEnum } from 'class-validator';

@UseFilters(SchulConnexValidationErrorFilter)
@ApiTags('personenkontexte')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'personenkontexte' })
export class PersonenkontextController {
    public constructor(
        private readonly personenkontextUc: PersonenkontextUc,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    @Get(':personenkontextId')
    @ApiOkResponse({
        description: 'The personenkontext was successfully returned.',
        type: PersonendatensatzResponseAutomapper,
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The personenkontext was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async findPersonenkontextById(
        @Param() params: FindPersonenkontextByIdParams,
    ): Promise<PersonendatensatzResponseAutomapper> {
        const request: FindPersonenkontextByIdDto = this.mapper.map(
            params,
            FindPersonenkontextByIdParams,
            FindPersonenkontextByIdDto,
        );
        const result: PersonendatensatzDto | SchulConnexError =
            await this.personenkontextUc.findPersonenkontextById(request);

        if (result instanceof SchulConnexError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(result);
        }

        const response: PersonendatensatzResponseAutomapper = this.mapper.map(
            result,
            PersonendatensatzDto,
            PersonendatensatzResponseAutomapper,
        );

        return response;
    }

    @Get()
    @ApiOkResponse({
        description: 'The personenkontexte were successfully returned.',
        type: [PersonendatensatzResponseAutomapper],
        headers: PagingHeadersObject,
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The personenkontexte were not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async findPersonenkontexte(
        @Query() queryParams: PersonenkontextQueryParams,
    ): Promise<PagedResponse<PersonenkontextdatensatzResponse>> {
        const findPersonenkontextDto: FindPersonenkontextDto = this.mapper.map(
            queryParams,
            PersonenkontextQueryParams,
            FindPersonenkontextDto,
        );
        const result: Paged<PersonenkontextDto> = await this.personenkontextUc.findAll(findPersonenkontextDto);
        const responseItems: PersonenkontextdatensatzResponse[] = this.mapper.mapArray(
            result.items,
            PersonenkontextDto,
            PersonenkontextdatensatzResponse,
        );
        const response: PagedResponse<PersonenkontextdatensatzResponse> = new PagedResponse({
            items: responseItems,
            total: result.total,
            offset: result.offset,
            limit: result.limit,
        });

        return response;
    }

    @Get(':personId/hatSystemrecht')
    @ApiOkResponse({
        type: SystemrechtResponse,
        description: 'The SchulStrukturKnoten associated with this personId and systemrecht.',
    })
    @ApiNotFoundResponse({ description: 'The systemrecht could not be found.' })
    public async hatSystemRecht(
        @Param() personByIdParams: PersonByIdParams,
        @Body() hatSystemrechtBodyParams: HatSystemrechtBodyParams,
    ): Promise<SystemrechtResponse> {
        if (!isEnum(hatSystemrechtBodyParams.systemRecht, RollenSystemRecht)) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(new EntityNotFoundError()),
            );
        }
        const systemrecht: RollenSystemRecht = hatSystemrechtBodyParams.systemRecht as RollenSystemRecht;
        const response: SystemrechtResponse = await this.personenkontextUc.hatSystemRecht(
            personByIdParams.personId,
            systemrecht,
        );
        return response;
    }

    @Put(':personenkontextId')
    @ApiOkResponse({
        description: 'The personenkontext was successfully updated.',
        type: PersonenkontextResponse,
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The personenkontext was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async updatePersonenkontextWithId(
        @Param() params: FindPersonenkontextByIdParams,
        @Body() body: UpdatePersonenkontextBodyParams,
    ): Promise<PersonendatensatzResponseAutomapper> {
        const dto: UpdatePersonenkontextDto = this.mapper.map(
            body,
            UpdatePersonenkontextBodyParams,
            UpdatePersonenkontextDto,
        );
        dto.id = params.personenkontextId;

        const response: PersonendatensatzDto | SchulConnexError =
            await this.personenkontextUc.updatePersonenkontext(dto);

        if (response instanceof SchulConnexError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(response);
        }

        return this.mapper.map(response, PersonendatensatzDto, PersonendatensatzResponseAutomapper);
    }

    @Delete(':personenkontextId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse({
        description: 'The personenkontext was successfully deleted.',
    })
    @ApiBadRequestResponse({ description: 'Request has wrong format.' })
    @ApiUnauthorizedResponse({ description: 'Request is not authorized.' })
    @ApiNotFoundResponse({ description: 'The personenkontext was not found.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to perform operation.' })
    @ApiInternalServerErrorResponse({ description: 'An internal server error occurred.' })
    public async deletePersonenkontextById(
        @Param() params: FindPersonenkontextByIdParams,
        @Body() body: DeleteRevisionBodyParams,
    ): Promise<void> {
        const dto: DeletePersonenkontextDto = this.mapper.map(body, DeleteRevisionBodyParams, DeletePersonenkontextDto);
        dto.id = params.personenkontextId;

        const response: void | SchulConnexError = await this.personenkontextUc.deletePersonenkontextById(dto);

        if (response instanceof SchulConnexError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(response);
        }
    }
}
