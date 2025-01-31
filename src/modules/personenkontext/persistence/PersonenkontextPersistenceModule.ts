import { Module } from '@nestjs/common';
import { DBiamPersonenkontextRepo } from './dbiam-personenkontext.repo.js';
import { PersonenkontextRepo } from './personenkontext.repo.js';
import { DBiamPersonenkontextRepoInternal } from './internal-dbiam-personenkontext.repo.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { PersonModule } from '../../person/person.module.js';
import { OrganisationModule } from '../../organisation/organisation.module.js';
import { RolleModule } from '../../rolle/rolle.module.js';

@Module({
    imports: [PersonModule, OrganisationModule, RolleModule],
    providers: [
        DBiamPersonenkontextRepo,
        PersonenkontextRepo,
        DBiamPersonenkontextRepoInternal,
        PersonenkontextFactory,
    ],
    exports: [DBiamPersonenkontextRepo, PersonenkontextRepo, DBiamPersonenkontextRepoInternal, PersonenkontextFactory],
})
export class PersonenkontextPersistenceModule {}
