import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import { PersonGender, PersonTrustLevel } from './person.enums.js';
import { CreatePersonBodyParams } from './create-person.body.params.js';

describe('CreatePersonBodyParams', () => {
    const referenceParams: CreatePersonBodyParams = {
        referrer: faker.string.uuid(),
        mandant: faker.string.uuid(),
        name: {
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            initialenvorname: faker.person.prefix(),
            initialenfamilienname: faker.person.suffix(),
            rufname: faker.person.fullName(),
            title: faker.person.jobTitle(),
            anrede: [faker.person.jobTitle()],
            namenssuffix: [faker.person.suffix()],
            sortierindex: faker.person.bio(),
        },
        geburt: {
            datum: faker.date.birthdate(),
            geburtsort: faker.location.city(),
        },
        geschlecht: PersonGender.UNKNOWN,
        lokalisierung: faker.location.zipCode(),
        vertrauensstufe: PersonTrustLevel.UNKNOWN,
        auskunftssperre: false,
    };

    it('should convert a plain object to a class of createPersonBodyParams', () => {
        const incomingParams: object = {
            referrer: referenceParams.referrer,
            mandant: referenceParams.mandant,
            name: {
                vorname: referenceParams.name.vorname,
                familienname: referenceParams.name.familienname,
                initialenvorname: referenceParams.name.initialenvorname,
                initialenfamilienname: referenceParams.name.initialenfamilienname,
                rufname: referenceParams.name.rufname,
                title: referenceParams.name.title,
                anrede: referenceParams.name.anrede,
                namenssuffix: referenceParams.name.namenssuffix,
                sortierindex: referenceParams.name.sortierindex,
            },
            geburt: {
                datum: referenceParams.geburt.datum,
                geburtsort: referenceParams.geburt.geburtsort,
            },
            geschlecht: referenceParams.geschlecht,
            lokalisierung: referenceParams.lokalisierung,
            vertrauensstufe: referenceParams.vertrauensstufe,
            auskunftssperre: referenceParams.auskunftssperre,
        };
        const mappedParams: CreatePersonBodyParams = plainToInstance(CreatePersonBodyParams, incomingParams, {});
        expect(mappedParams).toBeInstanceOf(CreatePersonBodyParams);
        expect(mappedParams).toEqual(referenceParams);
    });
});
