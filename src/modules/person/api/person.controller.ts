import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PersonUc } from '../api/person.uc.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonDto } from '../domain/create-person.dto.js';
import { ModuleLogger } from '../../../core/logging/logger.js';
import { MODULE_LOGGER } from '../../../core/logging/module-logger-factory.js';

@ApiTags('person')
@Controller({ path: 'person' })
export class PersonController {
    public constructor(private readonly uc: PersonUc, @Inject(getMapperToken()) private readonly mapper: Mapper, @Inject(MODULE_LOGGER) private logger: ModuleLogger) {
        this.logger.context = PersonController.name;
    }

    @Post()
    @ApiCreatedResponse({ description: 'The person was successfully created.' })
    @ApiBadRequestResponse({ description: 'The person already exists.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the person.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the person.' })
    public async createPerson(@Body() params: CreatePersonBodyParams): Promise<void> {
        this.logger.debug('PersonControllerdebug');
        this.logger.warning('PersonControllerwarning');
        const dto: CreatePersonDto = this.mapper.map(params, CreatePersonBodyParams, CreatePersonDto);
        await this.uc.createPerson(dto);
    }
}
