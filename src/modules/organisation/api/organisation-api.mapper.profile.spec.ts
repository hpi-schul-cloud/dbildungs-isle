import { Mapper } from '@automapper/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getMapperToken } from '@automapper/nestjs';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { faker } from '@faker-js/faker';
import { CreateOrganisationBodyParams } from './create-organisation.body.params.js';
import { OrganisationsTyp } from '../domain/organisation.enum.js';
import { CreateOrganisationDto } from './create-organisation.dto.js';
import { MappingError } from '../../../shared/error/mapping.error.js';
import { OrganisationApiMapperProfile } from './organisation-api.mapper.profile.js';
import { OrganisationDo } from '../domain/organisation.do.js';
import { CreatedOrganisationDto } from './created-organisation.dto.js';
import { OrganisationResponse } from './organisation.response.js';

describe('OrganisationApiMapperProfile', () => {
    let module: TestingModule;
    let sut: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [OrganisationApiMapperProfile],
        }).compile();
        sut = module.get(getMapperToken());
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('when the mapper is initialized', () => {
        const options: {
            kennung: string;
            kuerzel: string;
            name: string;
            namensergaenzung: string;
            typ: OrganisationsTyp;
        } = {
            kennung: faker.lorem.word(),
            kuerzel: faker.lorem.word(),
            name: faker.lorem.word(),
            namensergaenzung: faker.lorem.word(),
            typ: OrganisationsTyp.SONSTIGE,
        };
        const params: CreateOrganisationBodyParams = options;

        it('should map CreateOrganisationBodyParams to CreateOrganisationDto', () => {
            expect(() => sut.map(params, CreateOrganisationBodyParams, CreateOrganisationDto)).not.toThrowError(
                MappingError,
            );
        });

        const createOrganisationDto: CreateOrganisationDto = options;

        it('should map CreateOrganisationDto to OrganisationDo', () => {
            expect(() => sut.map(createOrganisationDto, CreateOrganisationDto, OrganisationDo<false>)).not.toThrowError(
                MappingError,
            );
        });

        const organisationDo: OrganisationDo<true> = DoFactory.createOrganisation(true);

        it('should map OrganisationDo to CreatedOrganisationDto', () => {
            expect(() => sut.map(organisationDo, OrganisationDo<true>, CreatedOrganisationDto)).not.toThrowError(
                MappingError,
            );
        });

        const createdOrganisationDto: CreatedOrganisationDto = {
            id: faker.string.uuid(),
            kennung: options.kennung,
            kuerzel: options.kuerzel,
            name: options.name,
            namensergaenzung: options.namensergaenzung,
            typ: options.typ,
        };

        it('should map CreatedOrganisationDto to OrganisationResponse', () => {
            expect(() =>
                sut.map(createdOrganisationDto, CreatedOrganisationDto, OrganisationResponse),
            ).not.toThrowError(MappingError);
        });
    });
});
