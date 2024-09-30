import { Body, Controller, Get, Param, Post, UseFilters } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOAuth2,
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
import { ApiOkResponsePaginated, PagingHeadersObject } from '../../../../shared/paging/index.js';
import { PersonenuebersichtBodyParams } from './personenuebersicht-body.params.js';
import { Permissions } from '../../../authentication/api/permissions.decorator.js';
import { PersonPermissions } from '../../../authentication/domain/person-permissions.js';
import { ConfigService } from '@nestjs/config';
import { ServerConfig, DataConfig } from '../../../../shared/config/index.js';
import { DbiamPersonenuebersicht } from '../../domain/dbiam-personenuebersicht.js';
import { OrganisationRepository } from '../../../organisation/persistence/organisation.repository.js';
import { AuthenticationExceptionFilter } from '../../../authentication/api/authentication-exception-filter.js';
import { Organisation } from '../../../organisation/domain/organisation.js';

@UseFilters(SchulConnexValidationErrorFilter, new AuthenticationExceptionFilter())
@ApiTags('dbiam-personenuebersicht')
@ApiBearerAuth()
@ApiOAuth2(['openid'])
@Controller({ path: 'dbiam/personenuebersicht' })
export class DBiamPersonenuebersichtController {
    public readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly personRepository: PersonRepository,
        private readonly dbiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly rolleRepository: RolleRepo,
        private readonly organisationRepository: OrganisationRepository,
        private config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    @Post('')
    @ApiOkResponsePaginated(DBiamPersonenuebersichtResponse, {
        description: 'The personenuebersichten were successfully returned.',
        headers: PagingHeadersObject,
    })
    @ApiUnauthorizedResponse({ description: 'Not authorized to get personenuebersichten.' })
    @ApiForbiddenResponse({ description: 'Insufficient permission to get personenuebersichten.' })
    @ApiInternalServerErrorResponse({ description: 'Internal server error while getting personenuebersichten.' })
    public async findPersonenuebersichten(
        @Body() bodyParams: PersonenuebersichtBodyParams,
        @Permissions() permissions: PersonPermissions,
    ): Promise<{ items: DBiamPersonenuebersichtResponse[] }> {
        const persons: Person<true>[] = await this.personRepository.findByIds(bodyParams.personIds, permissions);

        const items: DBiamPersonenuebersichtResponse[] = [];
        if (persons.length > 0) {
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
            const allOrganisations: Map<string, Organisation<true>> = await this.organisationRepository.findByIds(
                Array.from(allOrganisationIds),
            );
            const dbiamPersonenUebersicht: DbiamPersonenuebersicht = DbiamPersonenuebersicht.createNew(
                this.personRepository,
                this.dbiamPersonenkontextRepo,
                this.organisationRepository,
                this.rolleRepository,
                this.config,
            );

            persons.forEach((person: Person<true>) => {
                const personenKontexte: Personenkontext<true>[] = allPersonenKontexte.get(person.id) ?? [];
                const personenUebersichtenResult: [DBiamPersonenzuordnungResponse[], Date?] | EntityNotFoundError =
                    dbiamPersonenUebersicht.createZuordnungenForKontexte(personenKontexte, allRollen, allOrganisations);
                if (personenUebersichtenResult instanceof EntityNotFoundError) {
                    throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                        SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(personenUebersichtenResult),
                    );
                }
                items.push(
                    new DBiamPersonenuebersichtResponse(
                        person,
                        personenUebersichtenResult[0],
                        personenUebersichtenResult[1],
                    ),
                );
            });
        }

        return {
            items,
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
        @Permissions() permissions: PersonPermissions,
    ): Promise<DBiamPersonenuebersichtResponse> {
        const dbiamPersonenUebersicht: DbiamPersonenuebersicht = DbiamPersonenuebersicht.createNew(
            this.personRepository,
            this.dbiamPersonenkontextRepo,
            this.organisationRepository,
            this.rolleRepository,
            this.config,
        );
        const response: DBiamPersonenuebersichtResponse | EntityNotFoundError =
            await dbiamPersonenUebersicht.getPersonenkontexte(params.personId, permissions);

        if (response instanceof EntityNotFoundError) {
            throw SchulConnexErrorMapper.mapSchulConnexErrorToHttpException(
                SchulConnexErrorMapper.mapDomainErrorToSchulConnexError(response),
            );
        }

        return response;
    }
}
