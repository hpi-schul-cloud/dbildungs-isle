import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SchulConnexValidationErrorFilter } from '../../../../shared/error/schulconnex-validation-error.filter.js';
import { DBiamPersonenuebersichtResponse } from './dbiam-personenuebersicht.response.js';
import { DBiamFindPersonenuebersichtByPersonIdParams } from './dbiam-find-personenuebersicht-by-personid.params.js';
import { Person } from '../../domain/person.js';
import { PersonRepository } from '../../persistence/person.repository.js';
import { EntityNotFoundError } from '../../../../shared/error/entity-not-found.error.js';
import { SchulConnexErrorMapper } from '../../../../shared/error/schul-connex-error.mapper.js';
import { DBiamPersonenzuordnungResponse } from './dbiam-personenzuordnung.response.js';
import { Personenkontext } from '../../../personenkontext/domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from '../../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { RolleRepo } from '../../../rolle/repo/rolle.repo.js';
import { OrganisationID, PersonID, RolleID } from '../../../../shared/types/aggregate-ids.types.js';
import { Rolle } from '../../../rolle/domain/rolle.js';
import { OrganisationRepo } from '../../../organisation/persistence/organisation.repo.js';
import { OrganisationDo } from '../../../organisation/domain/organisation.do.js';
import { ApiOkResponsePaginated, PagedResponse, PagingHeadersObject } from '../../../../shared/paging/index.js';
import { PersonenuebersichtQueryParams } from './personenuebersicht-query.params.js';
import { DbiamPersonenuebersichtScope } from '../../persistence/dbiam-personenuebersicht-scope.js';

@UseFilters(SchulConnexValidationErrorFilter)
@ApiTags('dbiam-personenuebersicht')
@ApiBearerAuth()
@Controller({ path: 'dbiam/personenuebersicht' })
export class DBiamPersonenuebersichtController {
    public constructor(
        private readonly personRepository: PersonRepository,
        private readonly dbiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly rolleRepository: RolleRepo,
        private readonly organisationRepository: OrganisationRepo,
    ) {}

    @Get('')
    @ApiOkResponsePaginated(DBiamPersonenuebersichtResponse, {
        description: 'The personenuebersichten were successfully returned.',
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get personenuebersichten.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get personenuebersichten.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting personenuebersichten.' })
    public async findPersonenuebersichten(
        @Query() queryParams: PersonenuebersichtQueryParams,
    ): Promise<PagedResponse<DBiamPersonenuebersichtResponse>> {
        const items: DBiamPersonenuebersichtResponse[] = [];

        const scope: DbiamPersonenuebersichtScope = new DbiamPersonenuebersichtScope()
            .findBy({}) //no filtering in ticket spsh-488
            .paged(queryParams.offset, queryParams.limit);

        const [persons, total]: Counted<Person<true>> = await this.personRepository.findBy(scope);
        if (total > 0) {
            const allPersonIds: PersonID[] = persons.map((person: Person<true>) => person.id);
            const allPersonenKontexte: Map<PersonID, Personenkontext<true>[]> =
                await this.dbiamPersonenkontextRepo.findByPersonIds(allPersonIds);

            const allRollenIds: Set<RolleID> = new Set(
                Array.from(allPersonenKontexte.values()).flatMap((kontexte: Personenkontext<true>[]) =>
                    kontexte.map((kontext: Personenkontext<true>) => kontext.rolleId),
                ),
            );
            const allOrganisationIds: Set<OrganisationID> = new Set(
                Array.from(allPersonenKontexte.values()).flatMap((kontexte: Personenkontext<true>[]) =>
                    kontexte.map((kontext: Personenkontext<true>) => kontext.organisationId),
                ),
            );
            const allRollen: Map<string, Rolle<true>> = await this.rolleRepository.findByIds(Array.from(allRollenIds));
            const allOrganisations: Map<string, OrganisationDo<true>> = await this.organisationRepository.findByIds(
                Array.from(allOrganisationIds),
            );

            persons.forEach((person: Person<true>) => {
                const personenKontexte: Personenkontext<true>[] = allPersonenKontexte.get(person.id) ?? [];
                const personenUebersichten: DBiamPersonenzuordnungResponse[] = this.createZuordnungenForKontexte(
                    personenKontexte,
                    allRollen,
                    allOrganisations,
                );
                items.push(new DBiamPersonenuebersichtResponse(person, personenUebersichten));
            });
        }

        return {
            items,
            offset: queryParams.offset ?? 0,
            limit: queryParams.limit ?? 0,
            total,
        };
    }

    @Get(':personId')
    @ApiOkResponse({
        description: 'The personenuebersichten were successfully returned.',
        type: DBiamPersonenuebersichtResponse,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get personenuebersicht.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get personenuebersicht.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting personenuebersicht.' })
    public async findPersonenuebersichtenByPerson(
        @Param() params: DBiamFindPersonenuebersichtByPersonIdParams,
    ): Promise<DBiamPersonenuebersichtResponse> {
        const person: Option<Person<true>> = await this.personRepository.findById(params.personId);
        if (!person) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                    new EntityNotFoundError('Person', params.personId),
                ),
            );
        }
        const personenKontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(
            params.personId,
        );
        const rollenIdsForKontexte: RolleID[] = personenKontexte.map(
            (kontext: Personenkontext<true>) => kontext.rolleId,
        );
        const organisationIdsForKontexte: OrganisationID[] = personenKontexte.map(
            (kontext: Personenkontext<true>) => kontext.organisationId,
        );
        const rollenForKontexte: Map<string, Rolle<true>> = await this.rolleRepository.findByIds(rollenIdsForKontexte);
        const organisationsForKontexte: Map<string, OrganisationDo<true>> = await this.organisationRepository.findByIds(
            organisationIdsForKontexte,
        ); //use Organisation Aggregate as soon as there is one

        const personenUebersichten: DBiamPersonenzuordnungResponse[] = this.createZuordnungenForKontexte(
            personenKontexte,
            rollenForKontexte,
            organisationsForKontexte,
        );

        return new DBiamPersonenuebersichtResponse(person, personenUebersichten);
    }

    private createZuordnungenForKontexte(
        kontexte: Personenkontext<true>[],
        rollen: Map<string, Rolle<true>>,
        organisations: Map<string, OrganisationDo<true>>,
    ): DBiamPersonenzuordnungResponse[] {
        const personenUebersichten: DBiamPersonenzuordnungResponse[] = [];
        kontexte.forEach((pk: Personenkontext<true>) => {
            const rolle: Rolle<true> | undefined = rollen.get(pk.rolleId);
            const organisation: OrganisationDo<true> | undefined = organisations.get(pk.organisationId);
            if (!rolle) {
                throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                    SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                        new EntityNotFoundError('Rolle', pk.rolleId),
                    ),
                );
            }
            if (!organisation) {
                throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                    SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(
                        new EntityNotFoundError('Organisation', pk.organisationId),
                    ),
                );
            }
            personenUebersichten.push(new DBiamPersonenzuordnungResponse(pk, organisation, rolle));
        });
        return personenUebersichten;
    }
}
