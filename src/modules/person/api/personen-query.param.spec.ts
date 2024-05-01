import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import 'reflect-metadata';
import { SichtfreigabeType } from '../../personenkontext/domain/personenkontext.enums.js';
import { PersonenQueryParams } from './personen-query.param.js';

describe('PersonenQueryParam', () => {
    const referenceParams: PersonenQueryParams = {
        sichtfreigabe: SichtfreigabeType.JA,
        familienname: faker.person.lastName(),
        referrer: 'referrer',
        vorname: faker.person.firstName(),
        suchFilter: '',
    };

    it('should convert a plain object to a class of PersonenQueryParam', () => {
        const incomingParams: object = {
            sichtfreigabe: referenceParams.sichtfreigabe,
            familienname: referenceParams.familienname,
            referrer: referenceParams.referrer,
            vorname: referenceParams.vorname,
            suchFilter: referenceParams.suchFilter,
        };
        const mappedParams: PersonenQueryParams = plainToInstance(PersonenQueryParams, incomingParams, {});

        expect(mappedParams).toBeInstanceOf(PersonenQueryParams);
        expect(mappedParams).toEqual(referenceParams);
    });
});
