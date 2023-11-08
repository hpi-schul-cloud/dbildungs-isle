import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { plainToInstance } from 'class-transformer';
import { CreatePersonBodyParams } from './create-person.body.params.js';
import { Geschlecht, Vertrauensstufe } from '../domain/person.enums.js';

describe('CreatePersonBodyParams', () => {
    const referenceParams: CreatePersonBodyParams = {
        username: faker.internet.userName(),
        email: faker.internet.email(),
        referrer: faker.string.uuid(),
        mandant: faker.string.uuid(),
        name: {
            vorname: faker.person.firstName(),
            familienname: faker.person.lastName(),
            initialenvorname: faker.person.prefix(),
            initialenfamilienname: faker.person.suffix(),
            rufname: faker.person.fullName(),
            titel: faker.person.jobTitle(),
            anrede: [faker.person.jobTitle()],
            namenssuffix: [faker.person.suffix()],
            sortierindex: faker.person.bio(),
        },
        geburt: {
            datum: faker.date.birthdate(),
            geburtsort: faker.location.city(),
        },
        geschlecht: Geschlecht.X,
        lokalisierung: faker.location.zipCode(),
        vertrauensstufe: Vertrauensstufe.UNBE,
        auskunftssperre: false,
    };

    it('should convert a plain object to a class of createPersonBodyParams', () => {
        const incomingParams: object = {
            username: referenceParams.username,
            email: referenceParams.email,
            referrer: referenceParams.referrer,
            mandant: referenceParams.mandant,
            name: {
                vorname: referenceParams.name.vorname,
                familienname: referenceParams.name.familienname,
                initialenvorname: referenceParams.name.initialenvorname,
                initialenfamilienname: referenceParams.name.initialenfamilienname,
                rufname: referenceParams.name.rufname,
                titel: referenceParams.name.titel,
                anrede: referenceParams.name.anrede,
                namenssuffix: referenceParams.name.namenssuffix,
                sortierindex: referenceParams.name.sortierindex,
            },
            geburt: {
                datum: referenceParams.geburt?.datum,
                geburtsort: referenceParams.geburt?.geburtsort,
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
