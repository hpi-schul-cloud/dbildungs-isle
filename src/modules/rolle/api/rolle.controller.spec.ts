import { faker } from '@faker-js/faker';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_TIMEOUT_FOR_TESTCONTAINERS, DoFactory, MapperTestModule } from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';
import { RolleRepo } from '../repo/rolle.repo.js';
import { RolleFactory } from '../domain/rolle.factory.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { Rolle } from '../domain/rolle.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RolleController } from './rolle.controller.js';
import { FindRolleByIdParams } from './find-rolle-by-id.params.js';
import { OrganisationService } from '../../organisation/domain/organisation.service.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { CreateRolleBodyParams } from './create-rolle.body.params.js';
import { RollenArt, RollenMerkmal, RollenSystemRecht } from '../domain/rolle.enums.js';

import { NameForRolleWithTrailingSpaceError } from '../domain/name-with-trailing-space.error.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { RolleServiceProviderBodyParams } from './rolle-service-provider.body.params.js';

describe('Rolle API with mocked ServiceProviderRepo', () => {
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let serviceProviderRepoMock: DeepMocked<ServiceProviderRepo>;
    let rolleController: RolleController;
    let organisationServiceMock: DeepMocked<OrganisationService>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [MapperTestModule],
            providers: [
                {
                    provide: APP_PIPE,
                    useClass: GlobalValidationPipe,
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
                {
                    provide: OrganisationService,
                    useValue: createMock<OrganisationService>(),
                },
                {
                    provide: OrganisationRepository,
                    useValue: createMock<OrganisationRepository>(),
                },
                {
                    provide: ServiceProviderRepo,
                    useValue: createMock<ServiceProviderRepo>(),
                },
                {
                    provide: DBiamPersonenkontextRepo,
                    useValue: createMock<DBiamPersonenkontextRepo>(),
                },
                {
                    provide: RolleFactory,
                    useValue: createMock<RolleFactory>(),
                },
                {
                    provide: OrganisationService,
                    useValue: createMock<OrganisationService>(),
                },
                RolleController,
                RolleFactory,
            ],
        }).compile();

        rolleRepoMock = module.get(RolleRepo);
        serviceProviderRepoMock = module.get(ServiceProviderRepo);
        rolleController = module.get(RolleController);
        organisationServiceMock = module.get(OrganisationService);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('/PUT rolleId/serviceProviders mocked SP-repo', () => {
        describe('when rolle and serviceProvider exists, attachment is done, but retrieving SP afterwards fails', () => {
            it('should return 500', async () => {
                const rolleId: string = faker.string.uuid();
                const rolleByIdParams: FindRolleByIdParams = {
                    rolleId: rolleId,
                };
                const params: RolleServiceProviderBodyParams = {
                    serviceProviderIds: [faker.string.uuid()],
                    version: 1,
                };
                //mock get-rolle
                rolleRepoMock.findById.mockResolvedValueOnce(createMock<Rolle<true>>());

                // Mock the call to find service providers by IDs, returning an empty map
                serviceProviderRepoMock.findByIds.mockResolvedValueOnce(new Map());

                await expect(rolleController.updateServiceProvidersById(rolleByIdParams, params)).rejects.toThrow(
                    Error,
                );
            });
        });
    });

    describe('/GET rolle mocked Rolle-repo', () => {
        describe('createRolle', () => {
            it('should throw an HTTP exception when rolleFactory.createNew returns DomainError', async () => {
                const createRolleParams: CreateRolleBodyParams = {
                    name: ' SuS',
                    administeredBySchulstrukturknoten: faker.string.uuid(),
                    rollenart: RollenArt.LEHR,
                    merkmale: [RollenMerkmal.BEFRISTUNG_PFLICHT],
                    systemrechte: [RollenSystemRecht.KLASSEN_VERWALTEN],
                };

                const organisation: Organisation<true> = DoFactory.createOrganisation(true);
                organisationServiceMock.findOrganisationById.mockResolvedValueOnce({
                    ok: true,
                    value: organisation,
                });

                await expect(rolleController.createRolle(createRolleParams)).rejects.toThrow(
                    NameForRolleWithTrailingSpaceError,
                );
            });
        });
    });
});
