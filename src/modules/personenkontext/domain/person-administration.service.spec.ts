import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory } from '../../../../test/utils/do-factory.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { PersonAdministrationService } from './person-administration.service.js';

describe('PersonAdministrationService', () => {
    let module: TestingModule;
    let sut: PersonAdministrationService;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let organisationRepositoryMock: DeepMocked<OrganisationRepository>;
    let personpermissionsMock: DeepMocked<PersonPermissions>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                PersonAdministrationService,
                {
                    provide: getMapperToken(),
                    useValue: createMock<Mapper>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: PersonPermissions,
                    useValue: createMock<PersonPermissions>(),
                },
            ],
        }).compile();
        sut = module.get(PersonAdministrationService);
        rolleRepoMock = module.get(RolleRepo);
        organisationRepositoryMock = module.get(OrganisationRepository);
        personpermissionsMock = module.get(PersonPermissions);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('findAuthorizedRollen', () => {
        it('should return list of all rollen when they exist, if the user is Landesadmin', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                organisationRepositoryMock.ROOT_ORGANISATION_ID,
            ]);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock);
            expect(result).toEqual(rollen);
        });

        it('should return list of all rollen when they exist Except Landesadmin, if the user is NOT Landesadmin', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            const organisation: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            const organisationMap: Map<string, Organisation<true>> = new Map();
            organisationMap.set(organisation.id, organisation);
            organisationRepositoryMock.findByIds.mockResolvedValueOnce(organisationMap);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisation.id]);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock);
            expect(result).not.toContain(rolle);
        });

        it('should return list of rollen when they exist', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true);
            rolleRepoMock.findByName.mockResolvedValue([rolle]);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                organisationRepositoryMock.ROOT_ORGANISATION_ID,
            ]);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock, rolle.name);
            expect(result).toEqual([rolle]);
        });

        it('should return empty list when no rollen exist', async () => {
            rolleRepoMock.findByName.mockResolvedValue(undefined);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock, 'nonexistent');
            expect(result).toEqual([]);
        });

        it('should return list of limited rollen, if the user is Landesadmin and the limit is set', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([
                organisationRepositoryMock.ROOT_ORGANISATION_ID,
            ]);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock, undefined, 2);
            expect(result).toHaveLength(2);
        });

        it('should return list of limited allowedRollen, if the user is NOT Landesadmin and the limit is set', async () => {
            const rolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.SYSADMIN });
            const leitRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEIT });
            const lehrRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LEHR });
            const lernRolle: Rolle<true> = DoFactory.createRolle(true, { rollenart: RollenArt.LERN });

            const rollen: Rolle<true>[] = [rolle, leitRolle, lehrRolle, lernRolle];
            rolleRepoMock.find.mockResolvedValue(rollen);

            const organisationDo: Organisation<true> = DoFactory.createOrganisation(true, {
                typ: OrganisationsTyp.SCHULE,
            });
            const organisationMap: Map<string, Organisation<true>> = new Map();
            organisationMap.set(organisationDo.id, organisationDo);
            organisationRepositoryMock.findByIds.mockResolvedValueOnce(organisationMap);

            personpermissionsMock.getOrgIdsWithSystemrecht.mockResolvedValueOnce([organisationDo.id]);

            const result: Rolle<true>[] = await sut.findAuthorizedRollen(personpermissionsMock, undefined, 2);
            expect(result).toHaveLength(2);
        });
    });
});
