import { faker } from '@faker-js/faker/';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigTestModule } from '../../../../test/utils/config-test.module.js';
import { LoggingTestModule } from '../../../../test/utils/logging-test.module.js';
import { DatabaseTestModule, MapperTestModule } from '../../../../test/utils/index.js';
import { PersonModule } from '../../person/person.module.js';
import { PersonenKontextModule } from '../../personenkontext/personenkontext.module.js';
import { MikroORM } from '@mikro-orm/core';
import {
    DBiamPersonenkontextRepo,
    ExternalPkData,
} from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Person } from '../../person/domain/person.js';
import { ServiceProviderModule } from '../../service-provider/service-provider.module.js';
import { UserExternaldataWorkflowFactory } from '../domain/user-extenaldata.factory.js';
import { UserExeternalDataResponse } from './externaldata/user-externaldata.response.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import { RollenArt } from '../../rolle/domain/rolle.enums.js';
import { HttpException } from '@nestjs/common';
import { KeycloakInternalController } from './keycloakinternal.controller.js';

describe('KeycloakInternalController', () => {
    let module: TestingModule;
    let keycloakinternalController: KeycloakInternalController;
    let dbiamPersonenkontextRepoMock: DeepMocked<DBiamPersonenkontextRepo>;
    let personRepoMock: DeepMocked<PersonRepository>;
    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                ConfigTestModule,
                LoggingTestModule,
                MapperTestModule,
                ServiceProviderModule,
                DatabaseTestModule.forRoot({ isDatabaseRequired: true }),
                PersonModule,
                PersonenKontextModule,
            ],
            providers: [KeycloakInternalController, UserExternaldataWorkflowFactory],
        })
            .overrideProvider(PersonRepository)
            .useValue(createMock<PersonRepository>())
            .overrideProvider(DBiamPersonenkontextRepo)
            .useValue(createMock<DBiamPersonenkontextRepo>())
            .compile();

        await DatabaseTestModule.setupDatabase(module.get(MikroORM));

        keycloakinternalController = module.get(KeycloakInternalController);
        dbiamPersonenkontextRepoMock = module.get(DBiamPersonenkontextRepo);
        personRepoMock = module.get(PersonRepository);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        await module.get(MikroORM).close();
        await module.close();
    });

    it('should be defined', () => {
        expect(keycloakinternalController).toBeDefined();
    });

    describe('externalData', () => {
        it('should return user external data', async () => {
            const keycloakSub: string = faker.string.uuid();
            const person: Person<true> = Person.construct(
                faker.string.uuid(),
                faker.date.past(),
                faker.date.recent(),
                faker.person.lastName(),
                faker.person.firstName(),
                '1',
                faker.lorem.word(),
                keycloakSub,
                faker.string.uuid(),
            );
            person.geburtsdatum = faker.date.past();

            const pkExternalData: ExternalPkData[] = [
                {
                    rollenart: RollenArt.LEHR,
                    kennung: faker.lorem.word(),
                },
                {
                    rollenart: RollenArt.LERN,
                    kennung: faker.lorem.word(),
                },
                {
                    rollenart: RollenArt.EXTERN,
                    kennung: undefined, //To Be Filtered Out
                },
            ];

            personRepoMock.findById.mockResolvedValue(person);
            dbiamPersonenkontextRepoMock.findExternalPkData.mockResolvedValue(pkExternalData);

            const result: UserExeternalDataResponse = await keycloakinternalController.getExternalData({
                sub: keycloakSub,
            });
            expect(result).toBeInstanceOf(UserExeternalDataResponse);
            expect(result.ox.id).toContain(`${person.referrer}@`);
            expect(result.itslearning.personId).toEqual(person.id);
            expect(result.vidis.dienststellenNummern.length).toEqual(2);
            expect(result.opsh.vorname).toEqual(person.vorname);
            expect(result.opsh.nachname).toEqual(person.familienname);
            expect(result.opsh.emailAdresse).toEqual(person.email);
            expect(result.opsh.personenkontexte.length).toEqual(2);
            expect(result.onlineDateiablage.personId).toEqual(person.id);
        });

        it('should throw error if aggregate doesnt initialize fields field correctly', async () => {
            const keycloakSub: string = faker.string.uuid();
            const pkExternalData: ExternalPkData[] = [
                {
                    rollenart: RollenArt.LEHR,
                    kennung: faker.lorem.word(),
                },
                {
                    rollenart: RollenArt.LERN,
                    kennung: faker.lorem.word(),
                },
            ];

            personRepoMock.findById.mockResolvedValue(undefined);
            dbiamPersonenkontextRepoMock.findExternalPkData.mockResolvedValue(pkExternalData);

            await expect(keycloakinternalController.getExternalData({ sub: keycloakSub })).rejects.toThrow(
                HttpException,
            );
        });
    });
});
