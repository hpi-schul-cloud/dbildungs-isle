import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { PersonRepository } from '../persistence/person.repository.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { Person } from './person.js';
import { EntityNotFoundError } from '../../../shared/error/index.js';
import { OrganisationID, PersonID, RolleID } from '../../../shared/types/index.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { DBiamPersonenzuordnungResponse } from '../api/personenuebersicht/dbiam-personenzuordnung.response.js';
import { DBiamPersonenuebersichtResponse } from '../api/personenuebersicht/dbiam-personenuebersicht.response.js';
import { PermittedOrgas, PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { DataConfig, ServerConfig } from '../../../shared/config/index.js';
import { ConfigService } from '@nestjs/config';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Organisation } from '../../organisation/domain/organisation.js';

export class DbiamPersonenuebersicht {
    public readonly ROOT_ORGANISATION_ID: string;

    private constructor(
        private readonly personRepository: PersonRepository,
        private readonly dbiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly organisationRepository: OrganisationRepository,
        private readonly rolleRepo: RolleRepo,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    public static createNew(
        personRepository: PersonRepository,
        dbiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        organisationRepository: OrganisationRepository,
        rolleRepo: RolleRepo,
        configService: ConfigService<ServerConfig>,
    ): DbiamPersonenuebersicht {
        return new DbiamPersonenuebersicht(
            personRepository,
            dbiamPersonenkontextRepo,
            organisationRepository,
            rolleRepo,
            configService,
        );
    }

    public async getPersonenkontexte(
        personId: PersonID,
        permissions: PersonPermissions,
    ): Promise<DBiamPersonenuebersichtResponse | EntityNotFoundError> {
        const person: Option<Person<true>> = await this.personRepository.findById(personId);
        if (!person) {
            return new EntityNotFoundError('Person', personId);
        }
        // Find all organisations where user has permission
        const permittedOrgas: PermittedOrgas = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        const personenKontexte: Personenkontext<true>[] = await this.dbiamPersonenkontextRepo.findByPerson(personId);
        const rollenIdsForKontexte: RolleID[] = personenKontexte.map(
            (kontext: Personenkontext<true>) => kontext.rolleId,
        );
        const organisationIdsForKontexte: OrganisationID[] = personenKontexte.map(
            (kontext: Personenkontext<true>) => kontext.organisationId,
        );
        const rollenForKontexte: Map<string, Rolle<true>> = await this.rolleRepo.findByIds(rollenIdsForKontexte);
        const organisationsForKontexte: Map<string, Organisation<true>> = await this.organisationRepository.findByIds(
            organisationIdsForKontexte,
        ); //use Organisation Aggregate as soon as there is one

        const result: [DBiamPersonenzuordnungResponse[], Date?] | EntityNotFoundError =
            this.createZuordnungenForKontexte(
                personenKontexte,
                rollenForKontexte,
                organisationsForKontexte,
                permittedOrgas.all ? undefined : permittedOrgas.orgaIds,
            );
        if (result instanceof EntityNotFoundError) {
            return result;
        }

        return new DBiamPersonenuebersichtResponse(person, result[0], result[1]);
    }

    public createZuordnungenForKontexte(
        kontexte: Personenkontext<true>[],
        rollen: Map<string, Rolle<true>>,
        organisations: Map<string, Organisation<true>>,
        organisationIds?: string[],
    ): [DBiamPersonenzuordnungResponse[], Date?] | EntityNotFoundError {
        const personenUebersichten: DBiamPersonenzuordnungResponse[] = [];
        let lastModifiedZuordnungen: Date | undefined = undefined;
        for (const pk of kontexte) {
            const rolle: Rolle<true> | undefined = rollen.get(pk.rolleId);
            const organisation: Organisation<true> | undefined = organisations.get(pk.organisationId);
            if (!rolle) {
                return new EntityNotFoundError('Rolle', pk.rolleId);
            }
            if (!organisation) {
                return new EntityNotFoundError('Organisation', pk.organisationId);
            }
            // if permissions should not be checked or admin has PERSONEN_VERWALTEN at ROOT level
            if (organisationIds === undefined) {
                personenUebersichten.push(new DBiamPersonenzuordnungResponse(pk, organisation, rolle, true));
            } else {
                // if permissions should be checked
                if (organisationIds.some((orgaId: OrganisationID) => orgaId === organisation.id)) {
                    personenUebersichten.push(new DBiamPersonenzuordnungResponse(pk, organisation, rolle, true));
                } else {
                    personenUebersichten.push(new DBiamPersonenzuordnungResponse(pk, organisation, rolle, false));
                }
            }

            if (lastModifiedZuordnungen == undefined) {
                lastModifiedZuordnungen = pk.updatedAt;
            } else {
                lastModifiedZuordnungen =
                    lastModifiedZuordnungen.getTime() < pk.updatedAt.getTime() ? pk.updatedAt : lastModifiedZuordnungen;
            }
        }

        return [personenUebersichten, lastModifiedZuordnungen];
    }
}
