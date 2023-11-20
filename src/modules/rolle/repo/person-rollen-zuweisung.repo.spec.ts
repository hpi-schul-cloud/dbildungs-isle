import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ConfigTestModule,
    DEFAULT_TIMEOUT_FOR_TESTCONTAINERS,
    DatabaseTestModule,
    DoFactory,
    MapperTestModule,
} from '../../../../test/utils/index.js';
import { PersonRollenZuweisungDo } from '../domain/person-rollen-zuweisung.do.js';
import { RolleDo } from '../domain/rolle.do.js';
import { PersonRollenZuweisungEntity } from '../entity/person-rollen-zuweisung.entity.js';
import { PersonRollenZuweisungMapperProfile } from '../mapper/person-rollen-zuweisung.mapper.profile.js';
import { RolleMapperProfile } from '../mapper/rolle.mapper.profile.js';
import { PersonRollenZuweisungRepo } from './person-rollen-zuweisung.repo.js';

describe('PersonRollenZuweisungRepo', () => {
    let module: TestingModule;
    let sut: PersonRollenZuweisungRepo;
    let orm: MikroORM;
    let em: EntityManager;
    let mapper: Mapper;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [PersonRollenZuweisungMapperProfile, RolleMapperProfile, PersonRollenZuweisungRepo],
        }).compile();
        sut = module.get(PersonRollenZuweisungRepo);
        orm = module.get(MikroORM);
        em = module.get(EntityManager);
        mapper = module.get(getMapperToken());
        await DatabaseTestModule.setupDatabase(orm);
    }, DEFAULT_TIMEOUT_FOR_TESTCONTAINERS);

    afterAll(async () => {
        await module.close();
    });

    beforeEach(async () => {
        await DatabaseTestModule.clearDatabase(orm);
    });

    it('should be defined', () => {
        expect(sut).toBeDefined();
    });

    describe('findAllByPersonId via personId', () => {
        describe('when found by id', () => {
            it('should return found PersonRollenZuweisung', async () => {
                /*       const serviceProviderDo: ServiceProviderDo<false> = DoFactory.createServiceProvider(false);
                await em.persistAndFlush(mapper.map(serviceProviderDo, ServiceProviderDo, ServiceProviderEntity));

                const serviceProvider: ServiceProviderEntity[] = await em.find(ServiceProviderEntity, {});
                expect(serviceProvider).not.toBeNull();
                expect(serviceProvider).toHaveLength(1);

                const serviceProviderZugriffDo: ServiceProviderZugriffDo<false> = DoFactory.createServiceProviderZugriff(false, {serviceProvider: serviceProvider[0]!.id});
                await em.persistAndFlush(mapper.map(serviceProviderZugriffDo, ServiceProviderZugriffDo, ServiceProviderZugriffEntity));

                const serviceProviderZugriff: ServiceProviderZugriffEntity[] = await em.find(ServiceProviderZugriffEntity, {});
                expect(serviceProviderZugriff).not.toBeNull();
                expect(serviceProviderZugriff).toHaveLength(1);
                */
                const rolleDo: RolleDo<false> = DoFactory.createRolle(false);

                const personRollenZuweisungDo: PersonRollenZuweisungDo<false> = DoFactory.createPersonRollenZuweisung(
                    '1',
                    rolleDo,
                    false,
                );
                await em.persistAndFlush(
                    mapper.map(personRollenZuweisungDo, PersonRollenZuweisungDo, PersonRollenZuweisungEntity),
                );
                const personRollenZuweisung: PersonRollenZuweisungEntity[] = await em.find(
                    PersonRollenZuweisungEntity,
                    {},
                );
                expect(personRollenZuweisung).not.toBeNull();
                expect(personRollenZuweisung).toHaveLength(1);

                const foundPersonRollenZuweisung: PersonRollenZuweisungDo<true>[] = await sut.findAllByPersonId('1');
                expect(foundPersonRollenZuweisung).not.toBeNull();
                expect(foundPersonRollenZuweisung).toHaveLength(1);
            });
        });

        describe('when not found by personId', () => {
            it('should return null', async () => {
                const foundPersonRollenZuweisung: Option<PersonRollenZuweisungDo<true>[]> =
                    await sut.findAllByPersonId('1');
                expect(foundPersonRollenZuweisung).toHaveLength(0);
            });
        });
    });
});
