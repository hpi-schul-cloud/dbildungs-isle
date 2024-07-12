import { Mapper } from '@automapper/core';
import { getMapperToken } from '@automapper/nestjs';
import { Inject, Injectable } from '@nestjs/common';
import { Paged } from '../../../shared/paging/paged.js';
import { PersonDo } from '../../person/domain/person.do.js';
import { PersonService } from '../../person/domain/person.service.js';
import { PersonenkontextDo } from '../domain/personenkontext.do.js';
import { PersonenkontextService } from '../domain/personenkontext.service.js';
import { CreatePersonenkontextDto } from './create-personenkontext.dto.js';
import { CreatedPersonenkontextDto } from './created-personenkontext.dto.js';
import { FindPersonenkontextByIdDto } from './find-personenkontext-by-id.dto.js';
import { FindPersonenkontextDto } from './find-personenkontext.dto.js';
import { PersonDto } from '../../person/api/person.dto.js';
import { PersonendatensatzDto } from '../../person/api/personendatensatz.dto.js';
import { PersonenkontextDto } from './personenkontext.dto.js';
import { UpdatePersonenkontextDto } from './update-personenkontext.dto.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { SchulConnexError } from '../../../shared/error/schul-connex.error.js';
import { SchulConnexErrorMapper } from '../../../shared/error/schul-connex-error.mapper.js';
import { DeletePersonenkontextDto } from './delete-personkontext.dto.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { Personenkontext } from '../domain/personenkontext.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { OrganisationService } from '../../organisation/domain/organisation.service.js';
import { SystemrechtResponse } from './response/personenkontext-systemrecht.response.js';
import { OrganisationResponseLegacy } from '../../organisation/api/organisation.response.legacy.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { FindPersonenkontextByIdParams } from './param/find-personenkontext-by-id.params.js';
import { PersonenkontextdatensatzResponse } from './response/personenkontextdatensatz.response.js';
import { PersonendatensatzResponse } from '../../person/api/personendatensatz.response.js';
import { PersonendatensatzResponseAutomapper } from '../../person/api/personendatensatz.response-automapper.js';
import { Person } from '../../person/domain/person.js';
import { PersonResponseAutomapper } from '../../person/api/person.response-automapper.js';
import { PersonenkontextResponse } from './response/personenkontext.response.js';
import { PersonenkontextFactory } from '../domain/personenkontext.factory.js';
import { PersonenkontextQueryParams } from './param/personenkontext-query.params.js';

@Injectable()
export class PersonenkontextUc {
    public constructor(
        private readonly personService: PersonService,
        private readonly personenkontextService: PersonenkontextService,
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepo: OrganisationRepo,
        private readonly organisationService: OrganisationService,
        @Inject(getMapperToken()) private readonly mapper: Mapper,
        // private readonly personenkontextFactory: PersonenkontextFactory,
    ) {}

    public async createPersonenkontext(
        personenkontextDto: CreatePersonenkontextDto,
    ): Promise<CreatedPersonenkontextDto | SchulConnexError> {
        const personenkontextDo: PersonenkontextDo<false> = this.mapper.map(
            personenkontextDto,
            CreatePersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<
            PersonenkontextDo<true>,
            DomainError
        > = await this.personenkontextService.createPersonenkontext(personenkontextDo);

        if (result.ok) {
            return this.mapper.map(result.value, PersonenkontextDo, CreatedPersonenkontextDto);
        }
        return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
    }

    public async findAll(
        findPersonenkontext: PersonenkontextQueryParams,
        organisationIDs?: OrganisationID[] | undefined,
    ): Promise<Paged<Personenkontext<true>>> {
        const result: Paged<Personenkontext<true>> = await this.personenkontextService.findAllPersonenkontexte(
            findPersonenkontext,
            organisationIDs,
            findPersonenkontext.offset,
            findPersonenkontext.limit,
        );

        return {
            total: result.total,
            offset: result.offset,
            limit: result.limit,
            items: result.items,
        };
    }

    public async findPersonenkontextById(
        params: FindPersonenkontextByIdParams,
    ): Promise<PersonendatensatzResponseAutomapper | SchulConnexError> {
        const personenkontextResult: Result<
            Personenkontext<true>,
            DomainError
        > = await this.personenkontextService.findPersonenkontextById(params.personenkontextId);

        if (!personenkontextResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personenkontextResult.error);
        }
        // leave this DO for now as it goes to the repo
        const personResult: Result<Person<true>, DomainError> = await this.personService.findPersonById(
            personenkontextResult.value.personId,
        );

        if (!personResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personResult.error);
        }

        return new PersonendatensatzResponseAutomapper(new PersonResponseAutomapper(personResult.value), [
            await PersonenkontextResponse.construct(personenkontextResult.value),
        ]);
    }

    public async hatSystemRecht(personId: string, systemRecht: RollenSystemRecht): Promise<SystemrechtResponse> {
        const organisationDos: OrganisationDo<true>[] = [];
        const personenkontexte: Personenkontext<true>[] =
            await this.personenkontextService.findPersonenkontexteByPersonId(personId);
        for (const personenkontext of personenkontexte) {
            const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(personenkontext.rolleId);
            if (!rolle) continue;
            if (rolle.hasSystemRecht(systemRecht)) {
                const organisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(
                    personenkontext.organisationId,
                );
                if (organisation) {
                    organisationDos.push(organisation);
                    const children: Option<Paged<OrganisationDo<true>>> =
                        await this.organisationService.findAllAdministriertVon(personenkontext.organisationId);
                    organisationDos.push(...children.items);
                }
            }
        }
        const systemrechtResponse: SystemrechtResponse = new SystemrechtResponse();
        const organisationResponses: OrganisationResponseLegacy[] = this.mapper.mapArray(
            organisationDos,
            OrganisationDo,
            OrganisationResponseLegacy,
        );
        systemrechtResponse[RollenSystemRecht.ROLLEN_VERWALTEN] = organisationResponses;
        return systemrechtResponse;
    }

    public async updatePersonenkontext(
        updateDto: UpdatePersonenkontextDto,
    ): Promise<PersonendatensatzDto | SchulConnexError> {
        const personenkontextDo: PersonenkontextDo<true> = this.mapper.map(
            updateDto,
            UpdatePersonenkontextDto,
            PersonenkontextDo,
        );
        const result: Result<
            PersonenkontextDo<true>,
            DomainError
        > = await this.personenkontextService.updatePersonenkontext(personenkontextDo);

        if (!result.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
        }

        const personResult: Result<Person<true>, DomainError> = await this.personService.findPersonById(
            result.value.personId,
        );

        if (!personResult.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personResult.error);
        }

        return new PersonendatensatzDto({
            person: this.mapper.map(personResult.value, PersonDo, PersonDto),
            personenkontexte: [this.mapper.map(result.value, PersonenkontextDo, PersonenkontextDto)],
        });
    }

    public async deletePersonenkontextById(
        deletePersonenkontextDto: DeletePersonenkontextDto,
    ): Promise<void | SchulConnexError> {
        const result: Result<void, DomainError> = await this.personenkontextService.deletePersonenkontextById(
            deletePersonenkontextDto.id,
            deletePersonenkontextDto.revision,
        );

        if (!result.ok) {
            return SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(result.error);
        }
    }
}
