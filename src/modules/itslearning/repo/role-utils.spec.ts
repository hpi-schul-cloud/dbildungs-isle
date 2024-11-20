import {
    determineHighestRollenart,
    higherRollenart,
    lowerRollenart,
    rollenartToIMSESInstitutionRole,
    rollenartToIMSESRole,
} from './role-utils.js';

import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { IMSESInstitutionRoleType, IMSESRoleType } from '../types/role.enum.js';

const ROLLENARTEN: RollenArt[] = [
    RollenArt.EXTERN,
    RollenArt.LERN,
    RollenArt.LEHR,
    RollenArt.LEIT,
    RollenArt.ORGADMIN,
    RollenArt.SYSADMIN,
];

describe('itslearning role utils', () => {
    describe('higherRollenart', () => {
        it.each(
            ROLLENARTEN.map((rollenart: RollenArt, idx: number, array: RollenArt[]) => ({
                input: array.slice(0, idx + 1),
                expected: rollenart,
            })),
        )(
            '$expected should be ranked higher or equal than $input',
            ({ input, expected }: { input: RollenArt[]; expected: RollenArt }) => {
                for (const inputRole of input) {
                    expect(higherRollenart(inputRole, expected)).toBe(expected);
                }
            },
        );
    });

    describe('lowerRollenart', () => {
        it.each(
            ROLLENARTEN.map((rollenart: RollenArt, idx: number, array: RollenArt[]) => ({
                input: array.slice(idx),
                expected: rollenart,
            })),
        )(
            '$expected should be ranked lower or equal than $input',
            ({ input, expected }: { input: RollenArt[]; expected: RollenArt }) => {
                for (const inputRole of input) {
                    expect(lowerRollenart(inputRole, expected)).toBe(expected);
                }
            },
        );
    });

    describe('determineHighestRollenart', () => {
        it.each(
            ROLLENARTEN.map((rollenart: RollenArt, idx: number, array: RollenArt[]) => ({
                input: array.slice(0, idx + 1),
                expected: rollenart,
            })),
        )(
            'Given $input should return $expected',
            ({ input, expected }: { input: RollenArt[]; expected: RollenArt }) => {
                expect(determineHighestRollenart(input)).toBe(expected);
            },
        );

        it.each(
            ROLLENARTEN.map((rollenart: RollenArt, _: number, array: RollenArt[]) => ({
                input: array,
                limit: rollenart,
                expected: rollenart,
            })),
        )(
            'Given $input and a limit of $limit should return $expected',
            ({ input, limit, expected }: { input: RollenArt[]; limit: RollenArt; expected: RollenArt }) => {
                expect(determineHighestRollenart(input, limit)).toBe(expected);
            },
        );
    });

    describe('rollenartToIMSESInstitutionRole', () => {
        it.each([
            [RollenArt.EXTERN, IMSESInstitutionRoleType.GUEST],
            [RollenArt.LERN, IMSESInstitutionRoleType.STUDENT],
            [RollenArt.LEHR, IMSESInstitutionRoleType.STAFF],
            [RollenArt.LEIT, IMSESInstitutionRoleType.ADMINISTRATOR],
            [RollenArt.ORGADMIN, IMSESInstitutionRoleType.ADMINISTRATOR],
            [RollenArt.SYSADMIN, IMSESInstitutionRoleType.SYSTEM_ADMINISTRATOR],
        ])('Should map %s to %s', (rollenart: RollenArt, imsesRole: IMSESInstitutionRoleType) => {
            expect(rollenartToIMSESInstitutionRole(rollenart)).toBe(imsesRole);
        });
    });

    describe('rollenartToIMSESRole', () => {
        it.each([
            [RollenArt.EXTERN, IMSESRoleType.MEMBER],
            [RollenArt.LERN, IMSESRoleType.LEARNER],
            [RollenArt.LEHR, IMSESRoleType.INSTRUCTOR],
            [RollenArt.LEIT, IMSESRoleType.ADMINISTRATOR],
            [RollenArt.ORGADMIN, IMSESRoleType.ADMINISTRATOR],
            [RollenArt.SYSADMIN, IMSESRoleType.ADMINISTRATOR],
        ])('Should map %s to %s', (rollenart: RollenArt, imsesRole: IMSESRoleType) => {
            expect(rollenartToIMSESRole(rollenart)).toBe(imsesRole);
        });
    });
});
