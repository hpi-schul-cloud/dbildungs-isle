import { plainToInstance } from 'class-transformer';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { FindOrganisationQueryParams } from './find-organisation-query.param.js';

describe('FindOrganisationQueryParams', () => {
    it('should map systemrechte to array', () => {
        const test: FindOrganisationQueryParams = plainToInstance(FindOrganisationQueryParams, {
            systemrechte: RollenSystemRecht.ROLLEN_VERWALTEN,
        });

        expect(test.systemrechte).toEqual([RollenSystemRecht.ROLLEN_VERWALTEN]);
    });
});
