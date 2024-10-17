import { faker } from '@faker-js/faker';
import { ReadPersonAction } from './read-person.action.js';
import { IMSESInstitutionRoleType } from '../types/role.enum.js';
import { ItsLearningError } from '../../../shared/error/its-learning.error.js';

describe('ReadPersonAction', () => {
    describe('buildRequest', () => {
        it('should return object', () => {
            const action: ReadPersonAction = new ReadPersonAction(faker.string.uuid());

            expect(action.buildRequest()).toBeDefined();
        });
    });

    describe('isArrayOverride', () => {
        it("should return true for 'partName'", () => {
            const action: ReadPersonAction = new ReadPersonAction(faker.string.uuid());

            expect(action.isArrayOverride('partName')).toBe(true);
        });
    });

    describe('parseBody', () => {
        it('should return result', () => {
            const userId: string = faker.string.uuid();
            const username: string = faker.internet.userName();
            const firstName: string = faker.person.firstName();
            const lastName: string = faker.person.lastName();
            const email: string = faker.internet.email();
            const institutionRole: IMSESInstitutionRoleType = faker.helpers.enumValue(IMSESInstitutionRoleType);
            const primaryRoleType: boolean = faker.datatype.boolean();
            const action: ReadPersonAction = new ReadPersonAction(userId);

            expect(
                action.parseBody({
                    readPersonResponse: {
                        person: {
                            name: {
                                partName: [
                                    { namePartType: 'first', namePartValue: firstName },
                                    { namePartType: 'last', namePartValue: lastName },
                                ],
                            },
                            email,
                            userId: {
                                userIdValue: username,
                            },
                            institutionRole: {
                                institutionRoleType: institutionRole,
                                primaryRoleType,
                            },
                        },
                    },
                }),
            ).toEqual({
                ok: true,
                value: {
                    username,
                    firstName,
                    lastName,
                    institutionRole,
                    primaryRoleType,
                },
            });
        });

        it('should return error, if firstname is missing', () => {
            const userId: string = faker.string.uuid();
            const username: string = faker.internet.userName();
            const lastName: string = faker.person.lastName();
            const email: string = faker.internet.email();
            const institutionRole: IMSESInstitutionRoleType = faker.helpers.enumValue(IMSESInstitutionRoleType);
            const primaryRoleType: boolean = faker.datatype.boolean();
            const action: ReadPersonAction = new ReadPersonAction(userId);

            expect(
                action.parseBody({
                    readPersonResponse: {
                        person: {
                            name: {
                                partName: [{ namePartType: 'Last', namePartValue: lastName }],
                            },
                            email,
                            userId: {
                                userIdValue: username,
                            },
                            institutionRole: {
                                institutionRoleType: institutionRole,
                                primaryRoleType,
                            },
                        },
                    },
                }),
            ).toEqual({
                ok: false,
                error: new ItsLearningError('Person is missing a name.'),
            });
        });

        it('should return error, if lastname is missing', () => {
            const userId: string = faker.string.uuid();
            const username: string = faker.internet.userName();
            const firstName: string = faker.person.firstName();
            const email: string = faker.internet.email();
            const institutionRole: IMSESInstitutionRoleType = faker.helpers.enumValue(IMSESInstitutionRoleType);
            const primaryRoleType: boolean = faker.datatype.boolean();
            const action: ReadPersonAction = new ReadPersonAction(userId);

            expect(
                action.parseBody({
                    readPersonResponse: {
                        person: {
                            name: {
                                partName: [{ namePartType: 'First', namePartValue: firstName }],
                            },
                            email,
                            userId: {
                                userIdValue: username,
                            },
                            institutionRole: {
                                institutionRoleType: institutionRole,
                                primaryRoleType,
                            },
                        },
                    },
                }),
            ).toEqual({
                ok: false,
                error: new ItsLearningError('Person is missing a name.'),
            });
        });
    });
});
