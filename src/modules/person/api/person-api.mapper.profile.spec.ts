import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { MappingError } from '../../../shared/error/index.js';
import { CreatePersonDto } from './create-person.dto.js';
import { PersonDo } from '../domain/person.do.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { Jahrgangsstufe, Personenstatus, Rolle } from '../domain/personenkontext.enums.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { CreatePersonenkontextBodyParams } from './create-personenkontext.body.params.js';
import { CreatePersonenkontextDto } from './create-personenkontext.dto.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextByIdParams } from './find-personenkontext-by-id.params.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { LoeschungDto } from './loeschung.dto.js';
import { LoeschungResponse } from './loeschung.response.js';
import { PersonApiMapperProfile, personVisibilityToBooleanConverter } from './person-api.mapper.profile.js';
import { PersonBirthParams } from './person-birth.params.js';
import { PersonGeburtDto } from './person-geburt.dto.js';
import { PersonNameDto } from './person-name.dto.js';
import { PersonNameParams } from './person-name.params.js';
import { PersonDto } from './person.dto.js';
import { PersonResponse } from './person.response.js';
import { SichtfreigabeType } from './personen-query.param.js';
import { PersonendatensatzDto } from './personendatensatz.dto.js';
import { PersonendatensatzResponse } from './personendatensatz.response.js';
import { PersonenkontextQueryParams } from './personenkontext-query.params.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { PersonenkontextResponse } from './personenkontext.response.js';

describe('PersonApiMapperProfile', () => {
    let module: TestingModule;
    let sut: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [PersonApiMapperProfile],
        }).compile();
        sut = module.get(getMapperToken());
    });

    afterAll(async () => {
        await module.close();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('personVisibilityToBooleanConverter', () => {
        describe('when converting Visibility type to boolean', () => {
            it('should convert VisibilityType.JA to true', () => {
                expect(personVisibilityToBooleanConverter.convert(SichtfreigabeType.JA)).toBe(true);
            });

            it('should convert VisibilityType.NEIN to false', () => {
                expect(personVisibilityToBooleanConverter.convert(SichtfreigabeType.NEIN)).toBe(false);
            });
        });
    });

    describe('when mapper is initialized', () => {
        it('should map CreatePersonBodyParams to CreatePersonDTO', () => {
            const params: CreatePersonBodyParams = {
                username: faker.internet.userName(),
                mandant: faker.string.uuid(),
                stammorganisation: faker.string.uuid(),
                referrer: 'referrer',
                name: {
                    vorname: 'john',
                    familienname: 'doe',
                },
                geburt: {},
                lokalisierung: 'de-DE',
            };
            expect(() => sut.map(params, CreatePersonBodyParams, CreatePersonDto)).not.toThrowError(MappingError);
        });

        it('should map CreatePersonDto to PersonDo', () => {
            const dto: CreatePersonDto = {
                username: faker.internet.userName(),
                mandant: faker.string.uuid(),
                vorname: 'john',
                familienname: 'doe',
                lokalisierung: 'de-DE',
                referrer: 'referrer',
            };
            expect(() => sut.map(dto, CreatePersonDto, PersonDo)).not.toThrowError(MappingError);
        });

        it('should map CreatePersonenkontextBodyParams to CreatePersonenkontextDto', () => {
            const body: CreatePersonenkontextBodyParams = {
                rolle: Rolle.LEHRENDER,
                jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                personenstatus: Personenstatus.AKTIV,
                referrer: 'referrer',
            };
            expect(() => sut.map(body, CreatePersonenkontextBodyParams, CreatePersonenkontextDto)).not.toThrowError(
                MappingError,
            );
        });

        it('should map CreatePersonenkontextDto to PersonenkontextDo', () => {
            const dto: CreatePersonenkontextDto = {
                personId: faker.string.uuid(),
                rolle: Rolle.LEHRENDER,
                jahrgangsstufe: Jahrgangsstufe.JAHRGANGSSTUFE_1,
                personenstatus: Personenstatus.AKTIV,
                referrer: 'referrer',
            };
            expect(() => sut.map(dto, CreatePersonenkontextDto, PersonenkontextDo)).not.toThrowError(MappingError);
        });

        it('should map PersonenkontextDo to CreatedPersonenkontextDto', () => {
            const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
            expect(() => sut.map(personenkontextDo, PersonenkontextDo, CreatedPersonenkontextDto)).not.toThrowError(
                MappingError,
            );
        });

        it('should map PersonenkontextDo without loeschungZeitpunkt to CreatedPersonenkontextDto', () => {
            const personenkontextDo: PersonenkontextDo<true> = DoFactory.createPersonenkontext(true);
            personenkontextDo.loeschungZeitpunkt = undefined;

            expect(() => sut.map(personenkontextDo, PersonenkontextDo, CreatedPersonenkontextDto)).not.toThrowError(
                MappingError,
            );
        });

        it('should map CreatedPersonenkontextDto to PersonenkontextResponse', () => {
            expect(() =>
                sut.map({} as CreatedPersonenkontextDto, CreatedPersonenkontextDto, PersonenkontextResponse),
            ).not.toThrowError(MappingError);
        });

        it('should map PersonenkontextQueryParams to FindPersonenkontextDto', () => {
            const params: PersonenkontextQueryParams = {
                sichtfreigabe: SichtfreigabeType.JA,
                personenstatus: Personenstatus.AKTIV,
                referrer: 'referrer',
                rolle: Rolle.LERNENDER,
            };
            expect(() => sut.map(params, PersonenkontextQueryParams, FindPersonenkontextDto)).not.toThrowError(
                MappingError,
            );
        });

        it('should map FindPersonenkontextDto to PersonenkontextDo', () => {
            const dto: FindPersonenkontextDto = {
                personId: faker.string.uuid(),
                sichtfreigabe: SichtfreigabeType.JA,
                personenstatus: Personenstatus.AKTIV,
                referrer: 'referrer',
                rolle: Rolle.LERNENDER,
            };
            expect(() => sut.map(dto, FindPersonenkontextDto, PersonenkontextDo)).not.toThrowError(MappingError);
        });

        it('should map FindPersonenkontextByIdParams to FindPersonenkontextByIdDto', () => {
            expect(() =>
                sut.map({} as FindPersonenkontextByIdParams, FindPersonenkontextByIdParams, FindPersonenkontextByIdDto),
            ).not.toThrowError(MappingError);
        });

        it('should map PersonenkontextDo to PersonenkontextDto', () => {
            expect(() =>
                sut.map({} as PersonenkontextDo<boolean>, PersonenkontextDo, PersonenkontextDto),
            ).not.toThrowError(MappingError);
        });

        it('should map PersonDo to PersonDto', () => {
            expect(() => sut.map({} as PersonDo<boolean>, PersonDo, PersonDto)).not.toThrowError(MappingError);
        });

        it('should map LoeschungDto to LoeschungResponse', () => {
            expect(() => sut.map({} as LoeschungDto, LoeschungDto, LoeschungResponse)).not.toThrowError(MappingError);
        });

        it('should map PersonenkontextDto to PersonenkontextResponse', () => {
            expect(() =>
                sut.map({} as PersonenkontextDto, PersonenkontextDto, PersonenkontextResponse),
            ).not.toThrowError(MappingError);
        });

        it('should map PersonDto to PersonResponse', () => {
            expect(() => sut.map({} as PersonDto, PersonDto, PersonResponse)).not.toThrowError(MappingError);
        });

        it('should map PersonNameDto to PersonNameParams', () => {
            expect(() => sut.map({} as PersonNameDto, PersonNameDto, PersonNameParams)).not.toThrowError(MappingError);
        });

        it('should map PersonGeburtDto to PersonBirthParams', () => {
            expect(() => sut.map({} as PersonGeburtDto, PersonGeburtDto, PersonBirthParams)).not.toThrowError(
                MappingError,
            );
        });

        it('should map PersonendatensatzDto to PersonendatensatzResponse', () => {
            expect(() =>
                sut.map({} as PersonendatensatzDto, PersonendatensatzDto, PersonendatensatzResponse),
            ).not.toThrowError(MappingError);
        });
    });
});
