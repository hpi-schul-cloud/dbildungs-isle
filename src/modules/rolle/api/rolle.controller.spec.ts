import { faker } from '@faker-js/faker';
import { APP_PIPE } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_TIMEOUT_FOR_TESTCONTAINERS, MapperTestModule } from '../../../../test/utils/index.js';
import { GlobalValidationPipe } from '../../../shared/validation/global-validation.pipe.js';
import { RolleRepo } from '../repo/rolle.repo.js';
import { RolleFactory } from '../domain/rolle.factory.js';
import { ServiceProviderRepo } from '../../service-provider/repo/service-provider.repo.js';
import { Rolle } from '../domain/rolle.js';
import { RolleServiceProviderQueryParams } from './rolle-service-provider.query.params.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RolleController } from './rolle.controller.js';
import { FindRolleByIdParams } from './find-rolle-by-id.params.js';
import { OrganisationService } from '../../organisation/domain/organisation.service.js';

describe('Rolle API with mocked ServiceProviderRepo', () => {
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let serviceProviderRepoMock: DeepMocked<ServiceProviderRepo>;
    let rolleController: RolleController;

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
                    provide: ServiceProviderRepo,
                    useValue: createMock<ServiceProviderRepo>(),
                },
                RolleController,
                RolleFactory,
            ],
        }).compile();

        rolleRepoMock = module.get(RolleRepo);
        serviceProviderRepoMock = module.get(ServiceProviderRepo);
        rolleController = module.get(RolleController);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('/POST rolleId/serviceProviders mocked SP-repo', () => {
        describe('when rolle and serviceProvider exists, attachment is done, but retrieving SP afterwards fails', () => {
            it('should return 500', async () => {
                const rolleId: string = faker.string.uuid();
                const rolleByIdParams: FindRolleByIdParams = {
                    rolleId: rolleId,
                };
                const params: RolleServiceProviderQueryParams = {
                    serviceProviderId: faker.string.uuid(),
                };
                //mock get-rolle
                rolleRepoMock.findById.mockResolvedValueOnce(createMock<Rolle<true>>());
                //mock call to get sp (direct in controller-method)
                serviceProviderRepoMock.findById.mockResolvedValueOnce(undefined);

                await expect(rolleController.addServiceProviderById(rolleByIdParams, params)).rejects.toThrow(Error);
            });
        });
    });
});
