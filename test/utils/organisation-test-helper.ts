import { EntityManager, RequiredEntityData } from '@mikro-orm/core';
import { OrganisationsTyp } from '../../src/modules/organisation/domain/organisation.enums.js';
import { OrganisationRepository } from '../../src/modules/organisation/persistence/organisation.repository.js';
import { OrganisationID } from '../../src/shared/types/index.js';
import { OrganisationEntity } from '../../src/modules/organisation/persistence/organisation.entity.js';
import { faker } from '@faker-js/faker';

export async function createAndPersistRootOrganisation(
    em: EntityManager,
    organisationRepository: OrganisationRepository,
): Promise<OrganisationEntity> {
    const organisationData: RequiredEntityData<OrganisationEntity> = {
        id: organisationRepository.ROOT_ORGANISATION_ID,
        typ: OrganisationsTyp.ROOT,
        itslearningEnabled: false,
    };

    const organisationEntity: OrganisationEntity = em.create(OrganisationEntity, organisationData);
    await em.persistAndFlush(organisationEntity);

    return organisationEntity;
}

export async function createAndPersistOrganisation(
    em: EntityManager,
    parentOrga: OrganisationID | undefined,
    typ: OrganisationsTyp,
    fakeNames: boolean = true,
): Promise<OrganisationEntity> {
    const organisationData: RequiredEntityData<OrganisationEntity> = {
        administriertVon: parentOrga,
        zugehoerigZu: parentOrga,
        typ,
        kennung: fakeNames ? faker.lorem.word() : undefined,
        name: fakeNames ? faker.company.name() : undefined,
        namensergaenzung: fakeNames ? faker.company.name() : undefined,
        kuerzel: fakeNames ? faker.lorem.word() : undefined,
        itslearningEnabled: false,
    };
    const organisationEntity: OrganisationEntity = em.create(OrganisationEntity, organisationData);
    await em.persistAndFlush(organisationEntity);

    return organisationEntity;
}
