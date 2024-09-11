import { Test, TestingModule } from '@nestjs/testing';
import { EmailAddress, EmailAddressStatus } from './email-address.js';
import { faker } from '@faker-js/faker';

describe('EmailAddress Aggregate', () => {
    let module: TestingModule;
    let personId: string;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [],
        }).compile();
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        personId = faker.string.uuid();
    });

    describe('enabled', () => {
        describe('when email-address is enabled', () => {
            it('should return to true', () => {
                const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                    personId,
                    faker.internet.email(),
                    EmailAddressStatus.ENABLED,
                );

                expect(emailAddress.enabled).toBeTruthy();
            });
        });

        describe('when email-address is NOT enabled', () => {
            it('should return to false', () => {
                const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                    personId,
                    faker.internet.email(),
                    EmailAddressStatus.DISABLED,
                );

                expect(emailAddress.enabled).toBeFalsy();
            });
        });
    });

    describe('currentAddress', () => {
        describe('when email-address is enabled', () => {
            it('should return address', () => {
                const fakeEmail: string = faker.internet.email();
                const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                    personId,
                    fakeEmail,
                    EmailAddressStatus.ENABLED,
                );

                const currentAddress: Option<string> = emailAddress.currentAddress;
                expect(currentAddress).toBeDefined();
                expect(currentAddress).toStrictEqual(fakeEmail);
            });
        });

        describe('when email-address is NOT enabled', () => {
            it('should return undefined', () => {
                const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                    personId,
                    faker.internet.email(),
                    EmailAddressStatus.DISABLED,
                );

                expect(emailAddress.currentAddress).toBeFalsy();
            });
        });
    });

    describe('setAddress', () => {
        describe('when called', () => {
            it('should set address', () => {
                const fakeEmail: string = faker.internet.email();
                const newFakeEmail: string = faker.internet.email();
                const emailAddress: EmailAddress<false> = EmailAddress.createNew(
                    personId,
                    fakeEmail,
                    EmailAddressStatus.ENABLED,
                );

                const result: string = emailAddress.setAddress(newFakeEmail);
                expect(result).toStrictEqual(newFakeEmail);
                expect(emailAddress.address).toStrictEqual(newFakeEmail);
            });
        });
    });
});
