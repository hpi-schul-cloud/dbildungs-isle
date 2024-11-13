import { faker } from '@faker-js/faker';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { PersonApiMapper } from '../mapper/person-api.mapper.js';
import { PersonInfoController } from './person-info.controller.js';
import { PersonInfoResponse } from './person-info.response.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { Person } from '../domain/person.js';
import { EmailRepo } from '../../email/persistence/email.repo.js';
import { EmailAddressStatus } from '../../email/domain/email-address.js';
import { PersonEmailResponse } from './person-email-response.js';

describe('PersonInfoController', () => {
    let module: TestingModule;
    let sut: PersonInfoController;
    let personRepoMock: DeepMocked<PersonRepository>;
    let personenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let emailRepoMock: DeepMocked<EmailRepo>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonInfoController,
                PersonApiMapper,
                {
                    provide: ClassLogger,
                    useValue: createMock<ClassLogger>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
                {
                    provide: EmailRepo,
                    useValue: createMock<EmailRepo>(),
                },
            ],
        }).compile();

        sut = module.get<PersonInfoController>(PersonInfoController);
        personRepoMock = module.get(PersonRepository);
        personenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        emailRepoMock = module.get(EmailRepo);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('info', () => {
        describe('when person exists', () => {
            it('should return person info', async () => {
                // Arrange
                const person: Person<true> = DoFactory.createPerson(true);
                const permissions: PersonPermissions = {
                    personFields: {
                        id: faker.string.uuid(),
                    },
                } as PersonPermissions;
                const email: PersonEmailResponse = {
                    address: faker.internet.email(),
                    status: faker.helpers.enumValue(EmailAddressStatus),
                };

                personRepoMock.findById.mockResolvedValue(person);
                personenkontextRepoMock.findBy.mockResolvedValue([[], 0]);
                emailRepoMock.getEmailAddressAndStatusForPerson.mockResolvedValueOnce(email);

                // Act
                const result: PersonInfoResponse = await sut.info(permissions);

                // Assert
                expect(result).toEqual<PersonInfoResponse>({
                    pid: person.id,
                    person: {
                        id: person.id,
                        mandant: person.mandant,
                        referrer: person.referrer,
                        name: {
                            familiennamen: person.familienname,
                            vorname: person.vorname,
                            anrede: person.nameAnrede,
                            initialenfamilienname: person.initialenFamilienname,
                            initialenvorname: person.initialenVorname,
                            rufname: person.rufname,
                            titel: person.nameTitel,
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
                    personenkontexte: [],
                    gruppen: [],
                    email: {
                        address: email.address,
                        status: email.status,
                    },
                });
            });
        });

        describe('when person does not exist', () => {
            it('should return null', async () => {
                // Arrange
                const permissions: PersonPermissions = {
                    personFields: {
                        id: faker.string.uuid(),
                    },
                } as PersonPermissions;

                personRepoMock.findById.mockResolvedValue(null);

                // Act and Assert
                await expect(() => sut.info(permissions)).rejects.toThrow(HttpException);
            });
        });
    });
});
