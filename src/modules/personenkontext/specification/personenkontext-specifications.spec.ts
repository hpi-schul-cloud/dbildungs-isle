import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { ConfigTestModule, DatabaseTestModule, MapperTestModule } from '../../../../test/utils/index.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { DBiamPersonenkontextRepo } from '../persistence/dbiam-personenkontext.repo.js';
import { GleicheRolleAnKlasseWieSchule } from './gleiche-rolle-an-klasse-wie-schule.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { faker } from '@faker-js/faker';
import { MikroORM } from '@mikro-orm/core';

function createPersonenkontext<WasPersisted extends boolean>(
    this: void,
    withId: WasPersisted,
    params: Partial<Personenkontext<boolean>> = {},
): Personenkontext<WasPersisted> {
    const personenkontext: Personenkontext<WasPersisted> = Personenkontext.construct<boolean>(
        withId ? faker.string.uuid() : undefined,
        withId ? faker.date.past() : undefined,
        withId ? faker.date.recent() : undefined,
        faker.string.uuid(),
        faker.string.uuid(),
        faker.string.uuid(),
    );

    Object.assign(personenkontext, params);

    return personenkontext;
}

describe('PersonenkontextSpecificationsTest', () => {
    let module: TestingModule;
    let orm: MikroORM;
    let organisationRepoMock: DeepMocked<OrganisationRepo>;
    let rolleRepoMock: DeepMocked<RolleRepo>;
    let personenkontextRepo: DBiamPersonenkontextRepo;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigTestModule, DatabaseTestModule.forRoot({ isDatabaseRequired: true }), MapperTestModule],
            providers: [
                DBiamPersonenkontextRepo,
                {
                    provide: OrganisationRepo,
                    useValue: createMock<OrganisationRepo>(),
                },
                {
                    provide: RolleRepo,
                    useValue: createMock<RolleRepo>(),
                },
            ],
        }).compile();
        organisationRepoMock = module.get(OrganisationRepo);
        rolleRepoMock = module.get(RolleRepo);
        personenkontextRepo = module.get(DBiamPersonenkontextRepo);
        orm = module.get(MikroORM);

        await DatabaseTestModule.setupDatabase(orm);
    }, 100000);

    beforeEach(async () => {
        jest.resetAllMocks();
        await DatabaseTestModule.clearDatabase(orm);
    });

    afterAll(async () => {
        await orm.close();
        await module.close();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    describe('Gleiche Rolle An Klasse Wie Schule', () => {
        it('should not be satisfied when rolle could not be found', async () => {
            const klasse: OrganisationDo<true> = createMock<OrganisationDo<true>>();
            klasse.typ = OrganisationsTyp.KLASSE;
            const schule: OrganisationDo<true> = createMock<OrganisationDo<true>>();
            schule.typ = OrganisationsTyp.SCHULE;
            schule.id = faker.string.uuid();
            klasse.administriertVon = schule.id;
            const specification: GleicheRolleAnKlasseWieSchule = new GleicheRolleAnKlasseWieSchule(
                organisationRepoMock,
                personenkontextRepo,
                rolleRepoMock,
            );
            const personId: string = faker.string.uuid();
            const personenkontext: Personenkontext<false> = createPersonenkontext(false, { personId: personId });
            const foundPersonenkontextDummy: Personenkontext<false> = createPersonenkontext(false, {
                organisationId: schule.id,
                personId: personId,
            });
            await personenkontextRepo.save(foundPersonenkontextDummy);

            organisationRepoMock.findById.mockResolvedValueOnce(klasse); //mock Klasse
            organisationRepoMock.findById.mockResolvedValueOnce(schule); //mock Schule

            rolleRepoMock.findById.mockResolvedValueOnce(undefined);

            expect(await specification.isSatisfiedBy(personenkontext)).toBeFalsy();
        });
    });
});
