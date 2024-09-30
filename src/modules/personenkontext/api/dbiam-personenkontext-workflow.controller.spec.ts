import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { PersonPermissionsRepo } from '../../authentication/domain/person-permission.repo.js';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';

import { DbiamUpdatePersonenkontexteBodyParams } from './param/dbiam-update-personenkontexte.body.params.js';
import { PersonenkontexteUpdateError } from '../domain/error/personenkontexte-update.error.js';
import { DBiamFindPersonenkontexteByPersonIdParams } from './param/dbiam-find-personenkontext-by-personid.params.js';
import { PersonenkontextWorkflowAggregate } from '../domain/personenkontext-workflow.js';
import { PersonenkontextWorkflowFactory } from '../domain/personenkontext-workflow.factory.js';
import { FindDbiamPersonenkontextWorkflowBodyParams } from './param/dbiam-find-personenkontextworkflow-body.params.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { DbiamPersonenkontextWorkflowController } from './dbiam-personenkontext-workflow.controller.js';
import { PersonenkontextWorkflowResponse } from './response/dbiam-personenkontext-workflow-response.js';
import { PersonenkontextCreationService } from '../domain/personenkontext-creation.service.js';
import { DbiamUpdatePersonenkontexteQueryParams } from './param/dbiam-update-personenkontexte.query.params.js';

describe('DbiamPersonenkontextWorkflowController Test', () => {
    let module: TestingModule;
    let sut: DbiamPersonenkontextWorkflowController;
    let personenkontextWorkflowMock: DeepMocked<PersonenkontextWorkflowAggregate>;
    let personenkontextWorkflowFactoryMock: DeepMocked<PersonenkontextWorkflowFactory>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                DbiamPersonenkontextWorkflowController,
                {
                    provide: PersonPermissionsRepo,
                    useValue: createMock<PersonPermissionsRepo>(),
                },
                {
                    provide: PersonenkontextWorkflowFactory,
                    useValue: createMock<PersonenkontextWorkflowFactory>(),
                },
                {
                    provide: PersonenkontextWorkflowAggregate,
                    useValue: createMock<PersonenkontextWorkflowAggregate>(),
                },
                {
                    provide: PersonenkontextCreationService,
                    useValue: createMock<PersonenkontextCreationService>(),
                },
            ],
        }).compile();
        sut = module.get(DbiamPersonenkontextWorkflowController);

        personenkontextWorkflowMock = module.get(PersonenkontextWorkflowAggregate);
        personenkontextWorkflowFactoryMock = module.get(PersonenkontextWorkflowFactory);
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

    describe('/GET processStep for personenkontext', () => {
        it('should return selected organisation and all rollen', async () => {
            const organisationName: string = faker.company.name();
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, { name: organisationName });

            const rolleName: string = faker.string.alpha({ length: 10 });
            const rolle: Rolle<true> = DoFactory.createRolle(true, {
                name: rolleName,
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: RollenArt.LERN,
            });

            const personpermissions: DeepMocked<PersonPermissions> = createMock();
            personenkontextWorkflowMock.findAllSchulstrukturknoten.mockResolvedValueOnce([organisation]);
            personenkontextWorkflowMock.findRollenForOrganisation.mockResolvedValueOnce([rolle]);

            personenkontextWorkflowFactoryMock.createNew.mockReturnValueOnce(personenkontextWorkflowMock);
            const params: FindDbiamPersonenkontextWorkflowBodyParams = {
                organisationId: organisation.id,
            };

            const response: PersonenkontextWorkflowResponse = await sut.processStep(params, personpermissions);

            expect(response).toBeInstanceOf(PersonenkontextWorkflowResponse);
        });

        it('should handle request with no organisationId', async () => {
            const organisationName: string = faker.company.name();
            const randomName: string = faker.company.name();
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, { name: organisationName });
            const personpermissions: DeepMocked<PersonPermissions> = createMock();

            personenkontextWorkflowMock.findAllSchulstrukturknoten.mockResolvedValueOnce([organisation]);
            personenkontextWorkflowFactoryMock.createNew.mockReturnValueOnce(personenkontextWorkflowMock);

            const params: FindDbiamPersonenkontextWorkflowBodyParams = {
                organisationName: randomName,
            };

            const response: PersonenkontextWorkflowResponse = await sut.processStep(params, personpermissions);

            expect(response).toBeInstanceOf(PersonenkontextWorkflowResponse);
        });

        it('should call findRollenForOrganisation when organisationId is provided', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, { name: faker.company.name() });
            const rolle: Rolle<true> = DoFactory.createRolle(true, {
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: RollenArt.LERN,
            });

            const personpermissions: DeepMocked<PersonPermissions> = createMock();

            personenkontextWorkflowMock.findRollenForOrganisation.mockResolvedValueOnce([rolle]);
            personenkontextWorkflowMock.findAllSchulstrukturknoten.mockResolvedValueOnce([]);
            personenkontextWorkflowFactoryMock.createNew.mockReturnValueOnce(personenkontextWorkflowMock);
            const params: FindDbiamPersonenkontextWorkflowBodyParams = {
                organisationId: organisation.id,
            };

            const response: PersonenkontextWorkflowResponse = await sut.processStep(params, personpermissions);

            expect(response).toBeInstanceOf(PersonenkontextWorkflowResponse);
        });

        it('should return empty organisations and empty roles if organisationId is provided but no roles nor orgas are found', async () => {
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, { name: faker.company.name() });

            const personpermissions: DeepMocked<PersonPermissions> = createMock();

            personenkontextWorkflowMock.findAllSchulstrukturknoten.mockResolvedValueOnce([]);
            personenkontextWorkflowMock.findRollenForOrganisation.mockResolvedValueOnce([]);
            personenkontextWorkflowFactoryMock.createNew.mockReturnValueOnce(personenkontextWorkflowMock);
            const params: FindDbiamPersonenkontextWorkflowBodyParams = {
                organisationId: organisation.id,
            };

            const response: PersonenkontextWorkflowResponse = await sut.processStep(params, personpermissions);

            expect(response).toBeInstanceOf(PersonenkontextWorkflowResponse);
        });

        it('should set canCommit to true if canCommit returns true', async () => {
            const organisationId: string = faker.string.uuid();
            const organisation: Organisation<true> = DoFactory.createOrganisation(true, { typ: OrganisationsTyp.LAND });
            const rolle: Rolle<true> = DoFactory.createRolle(true, {
                administeredBySchulstrukturknoten: organisation.id,
                rollenart: RollenArt.LERN,
            });
            const rolleId: string = rolle.id;

            const personpermissions: DeepMocked<PersonPermissions> = createMock();

            const params: FindDbiamPersonenkontextWorkflowBodyParams = {
                organisationId,
                rolleId,
                organisationName: undefined,
                rolleName: undefined,
                limit: undefined,
            };
            personenkontextWorkflowMock.findAllSchulstrukturknoten.mockResolvedValueOnce([]);
            personenkontextWorkflowMock.findRollenForOrganisation.mockResolvedValue([rolle]);
            personenkontextWorkflowMock.canCommit.mockResolvedValue(true);
            personenkontextWorkflowFactoryMock.createNew.mockReturnValue(personenkontextWorkflowMock);

            const response: PersonenkontextWorkflowResponse = await sut.processStep(params, personpermissions);

            expect(response).toBeInstanceOf(PersonenkontextWorkflowResponse);
        });
    });
    describe('/PUT commit', () => {
        describe('when errors occur', () => {
            it('should throw BadRequestException if updateResult is an instance of PersonenkontexteUpdateError', async () => {
                const params: DBiamFindPersonenkontexteByPersonIdParams = { personId: faker.string.uuid() };
                const bodyParams: DbiamUpdatePersonenkontexteBodyParams = {
                    count: 1,
                    lastModified: new Date(),
                    personenkontexte: [],
                };
                const queryParams: DbiamUpdatePersonenkontexteQueryParams = {
                    personalnummer: '1234',
                };
                const updateError: PersonenkontexteUpdateError = new PersonenkontexteUpdateError(
                    'Update error message',
                );
                personenkontextWorkflowMock.commit.mockResolvedValueOnce(updateError);
                personenkontextWorkflowFactoryMock.createNew.mockReturnValue(personenkontextWorkflowMock);

                const personpermissions: DeepMocked<PersonPermissions> = createMock();

                await expect(sut.commit(params, queryParams, bodyParams, personpermissions)).rejects.toThrow(
                    PersonenkontexteUpdateError,
                );
            });
        });
    });
});
