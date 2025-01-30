import { OrganisationID, PersonID, RolleID } from '../../../shared/types/index.js';
import { Organisation } from '../../organisation/domain/organisation.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';
import { Person } from '../../person/domain/person.js';
import { Personenkontext } from '../../personenkontext/domain/personenkontext.js';
import { DBiamPersonenkontextRepo } from '../../personenkontext/persistence/dbiam-personenkontext.repo.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { IPersonPermissions } from '../../../shared/permissions/person-permissions.interface.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';

export type PersonFields = Pick<
    Person<true>,
    | 'id'
    | 'keycloakUserId'
    | 'vorname'
    | 'familienname'
    | 'rufname'
    | 'username'
    | 'geschlecht'
    | 'geburtsdatum'
    | 'updatedAt'
>;
type PersonKontextFields = Pick<Personenkontext<true>, 'rolleId' | 'organisationId'>;
type RolleFields = Pick<Rolle<true>, 'systemrechte' | 'serviceProviderIds'>;
export type PersonenkontextRolleFields = {
    organisationsId: OrganisationID;
    rolle: RolleFields;
};

export type PermittedOrgas = { all: true } | { all: false; orgaIds: OrganisationID[] };

export class PersonPermissions implements IPersonPermissions {
    private cachedPersonenkontextsFields?: PersonKontextFields[];

    private cachedPersonFields: PersonFields;

    private cachedRollenFields?: PersonenkontextRolleFields[];

    public constructor(
        private personenkontextRepo: DBiamPersonenkontextRepo,
        private organisationRepo: OrganisationRepository,
        private rolleRepo: RolleRepo,
        person: Person<true>,
    ) {
        this.cachedPersonFields = {
            id: person.id,
            keycloakUserId: person.keycloakUserId,
            vorname: person.vorname,
            familienname: person.familienname,
            rufname: person.rufname,
            username: person.username ?? person.referrer,
            geschlecht: person.geschlecht,
            geburtsdatum: person.geburtsdatum,
            updatedAt: person.updatedAt,
        };
    }

    public async getRoleIds(): Promise<RolleID[]> {
        const personKontextFields: PersonKontextFields[] = await this.getPersonenkontextsFields();

        return personKontextFields.map((personenkontextFields: PersonKontextFields) => {
            return personenkontextFields.rolleId;
        });
    }

    public async getOrgIdsWithSystemrecht(
        systemrechte: RollenSystemRecht[],
        withChildren: boolean = false,
        matchAll: boolean = true,
    ): Promise<PermittedOrgas> {
        if (await this.hasSystemrechteAtRootOrganisation(systemrechte, matchAll)) {
            return { all: true };
        }
        const organisationIDs: Set<OrganisationID> = new Set();

        const personKontextFields: PersonKontextFields[] = await this.getPersonenkontextsFields();
        const rollen: Map<RolleID, Rolle<true>> = await this.rolleRepo.findByIds(
            personKontextFields.map((pk: PersonKontextFields) => pk.rolleId),
        );

        for (const pk of personKontextFields) {
            const rolle: Rolle<true> | undefined = rollen.get(pk.rolleId);
            if (
                rolle &&
                (matchAll
                    ? systemrechte.every((r: RollenSystemRecht) => rolle.hasSystemRecht(r))
                    : systemrechte.some((r: RollenSystemRecht) => rolle.hasSystemRecht(r)))
            ) {
                organisationIDs.add(pk.organisationId);
            }
        }

        if (withChildren) {
            const childOrgas: Organisation<true>[] = await this.organisationRepo.findChildOrgasForIds(
                Array.from(organisationIDs),
            );

            childOrgas.forEach((orga: Organisation<true>) => organisationIDs.add(orga.id));
        }

        return {
            all: false,
            orgaIds: Array.from(organisationIDs),
        };
    }

    public async hasSystemrechteAtOrganisation(
        organisationId: OrganisationID,
        systemrechte: RollenSystemRecht[],
        matchAll: boolean = true,
    ): Promise<boolean> {
        const checks: Promise<boolean>[] = systemrechte.map(
            (systemrecht: RollenSystemRecht): Promise<boolean> =>
                this.hasSystemrechtAtOrganisation(organisationId, systemrecht),
        );
        const results: boolean[] = await Promise.all(checks);

        return matchAll
            ? results.every((result: boolean): boolean => result)
            : results.some((result: boolean): boolean => result);
    }

    public async hasSystemrechteAtRootOrganisation(
        systemrechte: RollenSystemRecht[],
        matchAll: boolean = true,
    ): Promise<boolean> {
        return this.hasSystemrechteAtOrganisation(this.organisationRepo.ROOT_ORGANISATION_ID, systemrechte, matchAll);
    }

    public async hasSystemrechtAtOrganisation(
        organisationId: OrganisationID,
        systemrecht: RollenSystemRecht,
    ): Promise<boolean> {
        return this.personenkontextRepo.hasSystemrechtAtOrganisation(
            this.cachedPersonFields.id,
            organisationId,
            systemrecht,
        );
    }

    public async canModifyPerson(personId: PersonID): Promise<boolean> {
        {
            const hasModifyRechtAtRoot: boolean = await this.hasSystemrechteAtRootOrganisation([
                RollenSystemRecht.PERSONEN_VERWALTEN,
            ]);

            if (hasModifyRechtAtRoot) {
                return true;
            }
        }

        {
            return this.hasSystemrechtAtAnyKontextOfTargetPerson(personId, RollenSystemRecht.PERSONEN_VERWALTEN);
        }
    }

    private async getPersonenkontextsFields(): Promise<PersonKontextFields[]> {
        if (!this.cachedPersonenkontextsFields) {
            const personenkontexte: Personenkontext<true>[] = await this.personenkontextRepo.findByPerson(
                this.personFields.id,
            );
            this.cachedPersonenkontextsFields = personenkontexte.map((personenkontext: Personenkontext<true>) => ({
                rolleId: personenkontext.rolleId,
                organisationId: personenkontext.organisationId,
            }));
        }

        return this.cachedPersonenkontextsFields;
    }

    public async getPersonenkontextewithRoles(): Promise<PersonenkontextRolleFields[]> {
        if (!this.cachedRollenFields) {
            const personKontextFields: PersonKontextFields[] = await this.getPersonenkontextsFields();
            const rollen: Map<RolleID, Rolle<true>> = await this.rolleRepo.findByIds(
                personKontextFields.map((pk: PersonKontextFields) => pk.rolleId),
            );

            this.cachedRollenFields = [];

            for (const pk of personKontextFields) {
                const rolle: Rolle<true> | undefined = rollen.get(pk.rolleId);
                if (rolle) {
                    this.cachedRollenFields.push({
                        organisationsId: pk.organisationId,
                        rolle: {
                            systemrechte: rolle.systemrechte,
                            serviceProviderIds: rolle.serviceProviderIds,
                        },
                    });
                }
            }
        }

        return this.cachedRollenFields;
    }

    private hasSystemrechtAtAnyKontextOfTargetPerson(
        targetPersonId: PersonID,
        systemrecht: RollenSystemRecht,
    ): Promise<boolean> {
        return this.personenkontextRepo.hasPersonASystemrechtAtAnyKontextOfPersonB(
            this.cachedPersonFields.id,
            targetPersonId,
            systemrecht,
        );
    }

    public get personFields(): PersonFields {
        return this.cachedPersonFields;
    }

    public async hasOrgVerwaltenRechtAtOrga(typ: OrganisationsTyp, administriertVon?: string): Promise<boolean> {
        if (typ === OrganisationsTyp.KLASSE) {
            const [oeffentlich]: [Organisation<true> | undefined, Organisation<true> | undefined] =
                await this.organisationRepo.findRootDirectChildren();
            return this.hasSystemrechtAtOrganisation(
                administriertVon ?? oeffentlich?.id ?? this.organisationRepo.ROOT_ORGANISATION_ID,
                RollenSystemRecht.KLASSEN_VERWALTEN,
            );
        } else if (typ === OrganisationsTyp.SCHULE) {
            return this.hasSystemrechteAtRootOrganisation([RollenSystemRecht.SCHULEN_VERWALTEN]);
        }
        return false;
    }
}
