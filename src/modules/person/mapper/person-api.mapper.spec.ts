import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonInfoResponse } from '../api/person-info.response.js';
import { Person } from '../domain/person.js';
import { PersonApiMapper } from './person-api.mapper.js';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { PersonEmailResponse } from '../api/person-email-response.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';

describe('PersonApiMapper', () => {
    let module: TestingModule;
    let sut: PersonApiMapper;
    let rolleRepoMock: DeepMocked<RolleRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
            ],
        }).compile();
        rolleRepoMock = module.get(RolleRepo);
        sut = new PersonApiMapper();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('toPersonInfoResponse', () => {
        describe('when mapping to PersonInfoResponse', () => {
            it('should return PersonInfoResponse', async () => {
                // Arrange
                const person: Person<true> = DoFactory.createPerson(true);
                rolleRepoMock.findById.mockResolvedValueOnce(DoFactory.createRolle(true));

                const kontext: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                    loeschungZeitpunkt: new Date(),
                    getRolle: () => rolleRepoMock.findById(faker.string.uuid()),
                });
                const kontexte: Personenkontext<true>[] = [kontext];
                const email: PersonEmailResponse = {
                    address: faker.internet.email(),
                    status: faker.helpers.enumValue(EmailAddressStatus),
                };

                // Act
                const result: PersonInfoResponse = await sut.mapToPersonInfoResponse(person, kontexte, email);

                // Assert
                expect(result).toBeInstanceOf(PersonInfoResponse);
                expect(result).toEqual<PersonInfoResponse>({
                    pid: person.id,
                    person: {
                        id: person.id,
                        referrer: person.referrer,
                        mandant: person.mandant,
                        name: {
                            titel: person.nameTitel,
                            anrede: person.nameAnrede,
                            vorname: person.vorname,
                            familiennamen: person.familienname,
                            initialenfamilienname: person.initialenFamilienname,
                            initialenvorname: person.initialenVorname,
                            rufname: person.rufname,
                            namenspraefix: person.namePraefix,
                            namenssuffix: person.nameSuffix,
                            sortierindex: person.nameSortierindex,
                        },
                        geburt: {
                            datum: person.geburtsdatum,
                            geburtsort: person.geburtsort,
                        },
                        stammorganisation: person.stammorganisation,
                        geschlecht: person.geschlecht,
                        lokalisierung: person.lokalisierung,
                        vertrauensstufe: person.vertrauensstufe,
                        personalnummer: person.personalnummer,
                        revision: person.revision,
                    },
                    personenkontexte: [
                        {
                            id: kontext.id,
                            referrer: kontext.referrer,
                            mandant: kontext.mandant ?? '',
                            organisation: {
                                id: kontext.organisationId,
                            },
                            personenstatus: kontext.personenstatus,
                            jahrgangsstufe: kontext.jahrgangsstufe,
                            sichtfreigabe: kontext.sichtfreigabe,
                            loeschung: { zeitpunkt: kontext.loeschungZeitpunkt as Date },
                            revision: kontext.revision,
                        },
                    ],
                    gruppen: [],
                    email: {
                        address: email.address,
                        status: email.status,
                    },
                });
            });
        });

        it('should return PersonInfoResponse and leave loeschung empty', async () => {
            // Arrange
            const person: Person<true> = DoFactory.createPerson(true);
            rolleRepoMock.findById.mockResolvedValueOnce(DoFactory.createRolle(true));

            const kontext: Personenkontext<true> = DoFactory.createPersonenkontext(true, {
                loeschungZeitpunkt: undefined,
                getRolle: () => rolleRepoMock.findById(faker.string.uuid()),
            });
            const kontexte: Personenkontext<true>[] = [kontext];
            const email: PersonEmailResponse = {
                address: faker.internet.email(),
                status: faker.helpers.enumValue(EmailAddressStatus),
            };

            // Act
            const result: PersonInfoResponse = await sut.mapToPersonInfoResponse(person, kontexte, email);

            // Assert
            expect(result).toBeInstanceOf(PersonInfoResponse);
            expect(result.personenkontexte[0]?.loeschung).toBeUndefined();
        });
    });
});
