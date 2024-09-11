import { Test, TestingModule } from '@nestjs/testing';

import { faker } from '@faker-js/faker';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { EmailRepo } from '../persistence/email.repo.js';
import { EmailFactory } from './email.factory.js';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { Person } from '../../person/domain/person.js';
import { InvalidNameError } from '../../../shared/error/index.js';
import { EmailGenerator } from './email-generator.js';

describe('EmailFactory', () => {
    let module: TestingModule;
    let sut: EmailFactory;
    let personRepositoryMock: DeepMocked<PersonRepository>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                EmailFactory,
                {
                    provide: EmailRepo,
                    useValue: createMock<EmailRepo>(),
                },
                {
                    provide: PersonRepository,
                    useValue: createMock<PersonRepository>(),
                },
            ],
        }).compile();
        personRepositoryMock = module.get(PersonRepository);
        sut = module.get(EmailFactory);
    });

    function getPerson(): Person<true> {
        return Person.construct(
            faker.string.uuid(),
            faker.date.past(),
            faker.date.recent(),
            faker.person.lastName(),
            faker.person.firstName(),
            '1',
            faker.lorem.word(),
            faker.lorem.word(),
            faker.string.uuid(),
        );
    }

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('construct', () => {
        describe('when constructing', () => {
            it('should return Email', () => {
                const personId: string = faker.string.uuid();
                const emailAddressId: string = faker.string.uuid();
                const address: string = faker.internet.email();
                const email: EmailAddress<true> = sut.construct(
                    emailAddressId,
                    faker.date.past(),
                    faker.date.recent(),
                    personId,
                    address,
                    EmailAddressStatus.ENABLED,
                );

                expect(email.personId).toStrictEqual(personId);
                expect(email.currentAddress).toStrictEqual(address);
                expect(email.enabled).toBeTruthy();
            });
        });
    });

    describe('createNew', () => {
        describe('when person is found and address generation succeeds ', () => {
            it('should return new Email', async () => {
                const person: Person<true> = getPerson();
                personRepositoryMock.findById.mockResolvedValueOnce(person);

                jest.spyOn(EmailGenerator.prototype, 'generateAvailableAddress').mockImplementation(
                    // eslint-disable-next-line @typescript-eslint/require-await
                    async (vorname: string, familienname: string) => {
                        return {
                            ok: true,
                            value: vorname + '.' + familienname + '@schule-sh.de',
                        };
                    },
                );

                const creationResult: Result<EmailAddress<false>> = await sut.createNew(person.id);

                if (!creationResult.ok) throw new Error();
                expect(creationResult.value.personId).toStrictEqual(person.id);
                expect(creationResult.value.address).toStrictEqual(
                    `${person.vorname}.${person.familienname}@schule-sh.de`,
                );
            });
        });

        describe('when person CANNOT be found', () => {
            it('should return error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(undefined);

                const creationResult: Result<EmailAddress<false>> = await sut.createNew(faker.string.uuid());

                expect(creationResult.ok).toBeFalsy();
            });
        });

        describe('when address generation fails', () => {
            it('should return error', async () => {
                personRepositoryMock.findById.mockResolvedValueOnce(getPerson());

                jest.spyOn(EmailGenerator.prototype, 'generateAvailableAddress').mockImplementation(
                    // eslint-disable-next-line @typescript-eslint/require-await
                    async (vorname: string, familienname: string) => {
                        return {
                            ok: false,
                            error: new InvalidNameError(vorname + '.' + familienname),
                        };
                    },
                );

                const creationResult: Result<EmailAddress<false>> = await sut.createNew(faker.string.uuid());

                expect(creationResult.ok).toBeFalsy();
            });
        });
    });
});
