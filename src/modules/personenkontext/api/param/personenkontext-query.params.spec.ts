import { plainToInstance } from 'class-transformer';
import 'reflect-metadata';
import { Personenstatus, SichtfreigabeType } from '../../domain/personenkontext.enums.js';
import { PersonenkontextQueryParams } from './personenkontext-query.params.js';

describe('PersonenkontextQueryParams', () => {
    const referenceParams: PersonenkontextQueryParams = {
        sichtfreigabe: SichtfreigabeType.JA,
        personenstatus: Personenstatus.AKTIV,
        referrer: 'referrer',
    };

    it('should convert a plain object to a class of PersonenkontextQueryParams', () => {
        const incomingParams: object = {
            sichtfreigabe: SichtfreigabeType.JA,
            personenstatus: Personenstatus.AKTIV,
            referrer: 'referrer',
        };
        const mappedParams: PersonenkontextQueryParams = plainToInstance(
            PersonenkontextQueryParams,
            incomingParams,
            {},
        );
        expect(mappedParams).toBeInstanceOf(PersonenkontextQueryParams);
        expect(mappedParams).toEqual(referenceParams);
    });
});
