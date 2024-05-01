import { Controller, Get, Inject, Query, UseFilters } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexValidationErrorFilter } from '../../../shared/error/schulconnex-validation-error.filter.js';
import { FindPersonenkontextRollenBodyParams } from './find-personenkontext-rollen.body.params.js';
import { FindPersonenkontextSchulstrukturknotenBodyParams } from './find-personenkontext-schulstrukturknoten.body.params.js';
import { FindRollenResponse } from './find-rollen.response.js';
import { FindSchulstrukturknotenResponse } from './find-schulstrukturknoten.response.js';
import { PersonenkontextAnlage } from '../domain/personenkontext-anlage.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { OrganisationResponseLegacy } from '../../organisation/api/organisation.response.legacy.js';
import { PersonenkontextAnlageFactory } from '../domain/personenkontext-anlage.factory.js';
import { getMapperToken } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';

@UseFilters(SchulConnexValidationErrorFilter)
@ApiTags('personenkontext')
@ApiBearerAuth()
@Controller({ path: 'personenkontext' })
export class DbiamPersonenkontextFilterController {
    public constructor(
        private readonly personenkontextAnlageFactory: PersonenkontextAnlageFactory,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
    ) {}

    @Get('rollen')
    @ApiOkResponse({
        description: 'The rollen for a personenkontext were successfully returned.',
        type: FindRollenResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get available rolen for personenkontexte.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get rollen for personenkontext.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting rollen for personenkontexte.' })
    public async findRollen(@Query() params: FindPersonenkontextRollenBodyParams): Promise<FindRollenResponse> {
        const anlage: PersonenkontextAnlage = this.personenkontextAnlageFactory.createNew();
        const rollen: Rolle<true>[] = await anlage.findRollen(params.rolleName, params.limit);
        const response: FindRollenResponse = new FindRollenResponse(rollen, rollen.length);

        return response;
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
        const anlage: PersonenkontextAnlage = this.personenkontextAnlageFactory.createNew();
        const sskName: string = params.sskName ?? '';
        const ssks: OrganisationDo<true>[] = await anlage.findSchulstrukturknoten(
            params.rolleId,
            sskName,
            params.limit,
        );
        const sskResponses: OrganisationResponseLegacy[] = this.mapper.mapArray(
            ssks,
            OrganisationDo,
            OrganisationResponseLegacy,
        );
        const response: FindSchulstrukturknotenResponse = new FindSchulstrukturknotenResponse(
            sskResponses,
            ssks.length,
        );

        return response;
    }
}
