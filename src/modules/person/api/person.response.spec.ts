import { faker } from '@faker-js/faker';
import { PersonLockOccasion, Vertrauensstufe } from '../domain/person.enums.js';
import { plainToInstance } from 'class-transformer';
import { PersonResponse } from './person.response.js';

describe('PersonResponseDDD', () => {
    const personResponse: PersonResponse = {
        id: faker.string.uuid(),
        name: {
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            initialenfamilienname: faker.person.lastName(),
            initialenvorname: faker.person.firstName(),
            rufname: faker.person.middleName(),
            titel: faker.string.alpha(),
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
        vertrauensstufe: Vertrauensstufe.VOLL,
        revision: '1',
        lastModified: faker.date.past(),
        userLock: [
            {
                personId: faker.string.uuid(),
                locked_by: 'test',
                created_at: new Date().toISOString(),
                locked_until: undefined,
                lock_occasion: PersonLockOccasion.KOPERS_GESPERRT,
            },
            {
                personId: faker.string.uuid(),
                locked_by: 'test',
                created_at: new Date().toISOString(),
                locked_until: undefined,
                lock_occasion: PersonLockOccasion.MANUELL_GESPERRT,
            },
        ],
    };

    it('should convert plain object of person response to a class of person response', () => {
        const person: object = {
            id: personResponse.id,
            name: personResponse.name,
            mandant: personResponse.mandant,
            referrer: personResponse.referrer,
            geburt: personResponse.geburt,
            geschlecht: personResponse.geschlecht,
            lokalisierung: personResponse.lokalisierung,
            vertrauensstufe: personResponse.vertrauensstufe,
            revision: personResponse.revision,
            lastModified: personResponse.lastModified,
            userLock: personResponse.userLock,
        };
        const mappedParams: PersonResponse = plainToInstance(PersonResponse, person, {});
        expect(mappedParams).toBeInstanceOf(PersonResponse);
        expect(mappedParams).toEqual(personResponse);
    });
});
