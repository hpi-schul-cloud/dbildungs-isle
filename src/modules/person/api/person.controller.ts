import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Body, Controller, Get, Inject, Post, Param, HttpException, HttpStatus } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PersonUc } from '../api/person.uc.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonDto } from '../domain/create-person.dto.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonByIdParams } from './person-by-id.param.js';
import { PersonResponse } from './person.response.js';

@ApiTags('person')
@Controller({ path: 'person' })
export class PersonController {
    public constructor(
        private readonly uc: PersonUc,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
        private logger: ClassLogger,
    ) {}

    @Post()
    @ApiCreatedResponse({ description: 'The person was successfully created.' })
    @ApiBadRequestResponse({ description: 'The person already exists.' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to create the person.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to create the person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while creating the person.' })
    public async createPerson(@Body() params: CreatePersonBodyParams): Promise<void> {
        this.logger.warning('PersonControllerwarning');
        this.logger.notice('PersonControllerNotice');
        this.logger.debug('PersonControllerdebug');
        const dto: CreatePersonDto = this.mapper.map(params, CreatePersonBodyParams, CreatePersonDto);
        await this.uc.createPerson(dto);
    }

    @Get(':personId')
    @ApiCreatedResponse({ description: 'The person was successfully pulled.' })
    @ApiBadRequestResponse({ description: 'Person ID is required' })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get the person.' })
    @ApiNotFoundResponse({ description: 'The person does not exist.' })
    @ApiForbiddenResponse({ description: 'Insufficient permissions to get the person.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting the person.' })
    public async findPersonById(@Param() params: PersonByIdParams): Promise<PersonResponse | HttpException> {
        try {
            const person: PersonResponse = await this.uc.findPersonById(params.personId);
            return person;
        } catch (error) {
            return new HttpException('Requested entity does not exist', HttpStatus.NOT_FOUND);
        }
    }
}
