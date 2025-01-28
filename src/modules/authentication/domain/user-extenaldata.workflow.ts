import { ConfigService } from '@nestjs/config';
import { OxConfig } from '../../../shared/config/ox.config.js';
import { ServerConfig } from '../../../shared/config/server.config.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { OXContextID } from '../../../shared/types/ox-ids.types.js';
import { Person } from '../../person/domain/person.js';
import { PersonRepository } from '../../person/persistence/person.repository.js';
import {
    DBiamPersonenkontextRepo,
    ExternalPkData,
} from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { RequiredExternalPkData } from '../api/authentication.controller.js';
import { DomainError } from '../../../shared/error/domain.error.js';

export class UserExternaldataWorkflowAggregate {
    public contextID: OXContextID;

    public person?: Person<true>;

    public checkedExternalPkData?: RequiredExternalPkData[];

    private constructor(
        private readonly personenkontextRepo: DBiamPersonenkontextRepo,
        private readonly personRepo: PersonRepository,
        configService: ConfigService<ServerConfig>,
    ) {
        const oxConfig: OxConfig = configService.getOrThrow<OxConfig>('OX');
        this.contextID = oxConfig.CONTEXT_ID;
    }

    public static createNew(
        personenkontextRepo: DBiamPersonenkontextRepo,
        personRepo: PersonRepository,
        configService: ConfigService<ServerConfig>,
    ): UserExternaldataWorkflowAggregate {
        return new UserExternaldataWorkflowAggregate(personenkontextRepo, personRepo, configService);
    }

    public async initialize(personId: string): Promise<void | DomainError> {
        const person: Option<Person<true>> = await this.personRepo.findById(personId);
        const externalPkData: ExternalPkData[] = await this.personenkontextRepo.findExternalPkData(personId);

        if (!person) {
            return new EntityNotFoundError('Person', personId);
        }
        this.person = person;

        // Filtering out !expk.kennung || !expk.rollenart automatically leads to only valid organisations of type SCHOOLS are included
        // Additionally If there is an data-invalidity the Endpoint still works (If throwing Errors not) and allows the Keycloak the get the data for the other Personenkontexte
        this.checkedExternalPkData = externalPkData
            .map((expk: ExternalPkData) => {
                if (expk.kennung && expk.rollenart) {
                    return {
                        rollenart: expk.rollenart,
                        kennung: expk.kennung,
                    } satisfies RequiredExternalPkData;
                }
                return undefined;
            })
            .filter((item: RequiredExternalPkData | undefined): item is RequiredExternalPkData => item !== undefined);
    }
}
