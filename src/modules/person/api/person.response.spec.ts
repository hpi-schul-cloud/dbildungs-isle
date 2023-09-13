import { faker } from '@faker-js/faker';
import { PersonResponse } from './person.response.js';
import { TrustLevel } from '../domain/person.enums.js';
import { plainToInstance } from 'class-transformer';

describe('PersonResponse', () => {
    const personResponse: PersonResponse = {
        id: faker.string.uuid(),
        name: {
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            initialenfamilienname: faker.person.lastName(),
            initialenvorname: faker.person.firstName(),
            rufname: faker.person.middleName(),
            title: faker.string.alpha(),
            anrede: [faker.string.alpha(), faker.string.alpha()],
            namenssuffix: [],
            namenspraefix: [],
            sortierindex: 'sortierindex',
        },
        mandant: faker.string.uuid(),
        referrer: faker.string.uuid(),
        geburt: {
            datum: new Date('2022.02.02'),
            geburtsort: faker.location.country(),
        },
        geschlecht: faker.person.gender(),
        lokalisierung: faker.location.country(),
        vertrauensstufe: TrustLevel.TRUSTED,
    };

    it('should convert plain object of person resopne to a class of person response', () => {
        const person: object = {
            id: personResponse.id,
            name: personResponse.name,
            mandant: personResponse.mandant,
            referrer: personResponse.referrer,
            geburt: personResponse.geburt,
            geschlecht: personResponse.geschlecht,
            lokalisierung: personResponse.lokalisierung,
            vertrauensstufe: personResponse.vertrauensstufe,
        };
        const mappedParams: PersonResponse = plainToInstance(PersonResponse, person, {});
        expect(mappedParams).toBeInstanceOf(PersonResponse);
        expect(mappedParams).toEqual(personResponse);
    });
});
