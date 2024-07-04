import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
import { OrganisationDo } from '../../organisation/domain/organisation.do.js';
import { OrganisationRepo } from '../../organisation/persistence/organisation.repo.js';
import { OrganisationsTyp } from '../../organisation/domain/organisation.enums.js';
import { OrganisationMatchesRollenart } from '../specification/organisation-matches-rollenart.js';
import { PersonPermissions } from '../../authentication/domain/person-permissions.js';
import { OrganisationID } from '../../../shared/types/aggregate-ids.types.js';
import { RollenSystemRecht } from '../../rolle/domain/rolle.enums.js';
import { DomainError } from '../../../shared/error/domain.error.js';
import { EntityNotFoundError } from '../../../shared/error/entity-not-found.error.js';
import { RolleNurAnPassendeOrganisationError } from '../specification/error/rolle-nur-an-passende-organisation.js';
import { MissingPermissionsError } from '../../../shared/error/missing-permissions.error.js';
import { PersonenkontexteUpdateError } from './error/personenkontexte-update.error.js';
import { Personenkontext } from './personenkontext.js';
import { PersonenkontexteUpdate } from './personenkontexte-update.js';
import { DbiamPersonenkontextFactory } from './dbiam-personenkontext.factory.js';
import { DbiamPersonenkontextBodyParams } from '../api/param/dbiam-personenkontext.body.params.js';
import { OrganisationRepository } from '../../organisation/persistence/organisation.repository.js';

export class PersonenkontextWorkflowAggregate {
    public selectedOrganisationId?: string;

    public selectedRolleId?: string;

    private constructor(
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepo: OrganisationRepo,
        private readonly organisationRepository: OrganisationRepository,
        private readonly dbiamPersonenkontextFactory: DbiamPersonenkontextFactory,
    ) {}

    public static createNew(
        rolleRepo: RolleRepo,
        organisationRepo: OrganisationRepo,
        organisationRepository: OrganisationRepository,
        dbiamPersonenkontextFactory: DbiamPersonenkontextFactory,
    ): PersonenkontextWorkflowAggregate {
        return new PersonenkontextWorkflowAggregate(
            rolleRepo,
            organisationRepo,
            organisationRepository,
            dbiamPersonenkontextFactory,
        );
    }

    // Initialize the aggregate with the selected Organisation and Rolle
    public initialize(organisationId?: string, rolleId?: string): void {
        this.selectedOrganisationId = organisationId;
        this.selectedRolleId = rolleId;
    }

    // Finds all SSKs that the admin can see
    public async findAllSchulstrukturknoten(
        permissions: PersonPermissions,
        organisationName: string | undefined,
        limit?: number,
    ): Promise<OrganisationDo<true>[]> {
        let allOrganisations: OrganisationDo<boolean>[] = [];
        // If the search string for organisation is present then search for Name or Kennung
        if (organisationName) {
            allOrganisations = await this.organisationRepo.findByNameOrKennung(organisationName);
        } else {
            // Otherwise just retrieve all orgas
            allOrganisations = await this.organisationRepo.find(limit);
        }
        if (allOrganisations.length === 0) return [];

        const orgsWithRecht: OrganisationID[] = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );
        //TODO: Query the filtering of Organisations in the DB
        // Return only the orgas that the admin have rights on
        let filteredOrganisations: OrganisationDo<boolean>[] = allOrganisations.filter(
            (orga: OrganisationDo<boolean>) => orgsWithRecht.includes(orga.id as OrganisationID),
        );
        // Exclude Klassen from the orgas as they are separately chosen through another EP
        filteredOrganisations = filteredOrganisations.filter(
            (orga: OrganisationDo<boolean>) => orga.typ !== OrganisationsTyp.KLASSE,
        );

        // Sort the filtered organizations, handling undefined kennung and name
        filteredOrganisations.sort((a: OrganisationDo<boolean>, b: OrganisationDo<boolean>) => {
            if (a.name && b.name) {
                const aTitle: string = a.kennung ? `${a.kennung} (${a.name})` : a.name;
                const bTitle: string = b.kennung ? `${b.kennung} (${b.name})` : b.name;
                return aTitle.localeCompare(bTitle, 'de', { numeric: true });
            }
            // Ensure a return value for cases where name is not defined (Should never happen normally)
            if (a.name) return -1;
            if (b.name) return 1;
            return 0;
        });
        // Return only the orgas that the admin have rights on
        return filteredOrganisations;
    }

    public async findRollenForOrganisation(
        permissions: PersonPermissions,
        rolleName?: string,
        limit?: number,
    ): Promise<Rolle<true>[]> {
        let rollen: Option<Rolle<true>[]>;

        if (rolleName) {
            rollen = await this.rolleRepo.findByName(rolleName);
        } else {
            rollen = await this.rolleRepo.find();
        }

        if (!rollen) {
            return [];
        }

        // Retrieve all organisations that the admin has access to
        const orgsWithRecht: OrganisationID[] = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        // If the admin has no right on any orga then return an empty array
        if (!orgsWithRecht || orgsWithRecht.length === 0) {
            return [];
        }

        let organisation: Option<OrganisationDo<true>>;
        if (this.selectedOrganisationId) {
            // The organisation that was selected and that will be the base for the returned roles
            organisation = await this.organisationRepo.findById(this.selectedOrganisationId);
        }
        // If the organisation was not found with the provided selected Id then just return an array of empty orgas
        if (!organisation) {
            return [];
        }

        let allowedRollen: Rolle<true>[] = [];
        // If the user has rights for this specific organization or any of its children, return the filtered roles
        if (orgsWithRecht.includes(organisation.id)) {
            const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
            rollen.forEach(function (rolle: Rolle<true>) {
                // Check here what kind of roles the admin can assign depending on the type of organisation
                if (organisationMatchesRollenart.isSatisfiedBy(organisation, rolle) && !allowedRollen.includes(rolle)) {
                    allowedRollen.push(rolle);
                }
            });
        }
        if (limit) {
            allowedRollen = allowedRollen.slice(0, limit);
        }

        // Sort the Roles by name
        return allowedRollen.sort((a: Rolle<true>, b: Rolle<true>) =>
            a.name.localeCompare(b.name, 'de', { numeric: true }),
        );
    }

    // Verifies if the selected rolle and organisation can together be assigned to a kontext
    // Also verifies again if the organisationId is allowed to be assigned by the admin
    public async canCommit(permissions: PersonPermissions): Promise<DomainError | boolean> {
        if (this.selectedOrganisationId && this.selectedRolleId) {
            const referenceCheckError: Option<DomainError> = await this.checkReferences(
                this.selectedOrganisationId,
                this.selectedRolleId,
            );
            if (referenceCheckError) {
                return referenceCheckError;
            }

            const permissionCheckError: Option<DomainError> = await this.checkPermissions(
                permissions,
                this.selectedOrganisationId,
            );
            if (permissionCheckError) {
                return permissionCheckError;
            }
        }

        return true;
    }

    // Takes in the list of personenkontexte and decides whether to add or delete the personenkontexte for a specific PersonId
    // This will only be used during "bearbeiten".
    public async commit(
        personId: string,
        lastModified: Date,
        count: number,
        personenkontexte: DbiamPersonenkontextBodyParams[],
    ): Promise<Personenkontext<true>[] | PersonenkontexteUpdateError> {
        const pkUpdate: PersonenkontexteUpdate = this.dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
            personId,
            lastModified,
            count,
            personenkontexte,
        );
        const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await pkUpdate.update();

        if (updateResult instanceof PersonenkontexteUpdateError) {
            return updateResult;
        }
        return updateResult;
    }

    // Checks if the rolle can be assigned to the target organisation
    public async checkReferences(organisationId: string, rolleId: string): Promise<Option<DomainError>> {
        const [orga, rolle]: [Option<OrganisationDo<true>>, Option<Rolle<true>>] = await Promise.all([
            this.organisationRepository.findById(organisationId),
            this.rolleRepo.findById(rolleId),
        ]);

        if (!orga) {
            return new EntityNotFoundError('Organisation', organisationId);
        }

        if (!rolle) {
            return new EntityNotFoundError('Rolle', rolleId);
        }
        // Can rolle be assigned at target orga
        const canAssignRolle: boolean = await rolle.canBeAssignedToOrga(organisationId);
        if (!canAssignRolle) {
            return new EntityNotFoundError('Rolle', rolleId); // Rolle does not exist for the chosen organisation
        }

        //The aimed organisation needs to match the type of role to be assigned
        const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
        if (!organisationMatchesRollenart.isSatisfiedBy(orga, rolle)) {
            return new RolleNurAnPassendeOrganisationError();
        }

        return undefined;
    }

    public async checkPermissions(
        permissions: PersonPermissions,
        organisationId: string,
    ): Promise<Option<DomainError>> {
        // Check if logged in person has permission
        const hasPermissionAtOrga: boolean = await permissions.hasSystemrechtAtOrganisation(organisationId, [
            RollenSystemRecht.PERSONEN_VERWALTEN,
        ]);

        // Missing permission on orga
        if (!hasPermissionAtOrga) {
            return new MissingPermissionsError('Unauthorized to manage persons at the organisation');
        }

        return undefined;
    }

    public async findSchulstrukturknoten(
        rolleId: string,
        sskName: string,
        limit?: number,
        excludeKlassen: boolean = false,
    ): Promise<OrganisationDo<true>[]> {
        this.selectedRolleId = rolleId;

        const organisationsFoundByName: Option<OrganisationDo<true>[]> =
            await this.organisationRepo.findByNameOrKennung(sskName);
        if (organisationsFoundByName.length === 0) return [];

        const rolleResult: Option<Rolle<true>> = await this.rolleRepo.findById(rolleId);
        if (!rolleResult) return [];

        const organisationsRoleIsAvalableIn: OrganisationDo<true>[] = [];

        const parentOrganisation: Option<OrganisationDo<true>> = await this.organisationRepo.findById(
            rolleResult.administeredBySchulstrukturknoten,
        );
        if (!parentOrganisation) return [];
        organisationsRoleIsAvalableIn.push(parentOrganisation);

        const childOrganisations: OrganisationDo<true>[] = await this.organisationRepo.findChildOrgasForIds([
            rolleResult.administeredBySchulstrukturknoten,
        ]);
        organisationsRoleIsAvalableIn.push(...childOrganisations);

        let orgas: OrganisationDo<true>[] = organisationsFoundByName.filter((ssk: OrganisationDo<true>) =>
            organisationsRoleIsAvalableIn.some((organisation: OrganisationDo<true>) => ssk.id === organisation.id),
        );
        //TODO: Please filter by OrganisationsTyp in the DB requests
        if (excludeKlassen) {
            orgas = orgas.filter((ssk: OrganisationDo<true>) => ssk.typ !== OrganisationsTyp.KLASSE);
        }

        const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
        orgas = orgas.filter((orga: OrganisationDo<true>) =>
            organisationMatchesRollenart.isSatisfiedBy(orga, rolleResult),
        );

        return orgas.slice(0, limit);
    }

    public async findAuthorizedRollen(
        permissions: PersonPermissions,
        rolleName?: string,
        limit?: number,
    ): Promise<Rolle<true>[]> {
        let rollen: Option<Rolle<true>[]>;

        if (rolleName) {
            rollen = await this.rolleRepo.findByName(rolleName);
        } else {
            rollen = await this.rolleRepo.find();
        }

        if (!rollen) return [];

        const orgsWithRecht: OrganisationID[] = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        //Landesadmin can view all roles.
        if (orgsWithRecht.includes(this.organisationRepo.ROOT_ORGANISATION_ID)) {
            return limit ? rollen.slice(0, limit) : rollen;
        }

        const allowedRollen: Rolle<true>[] = [];
        const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
        (await this.organisationRepo.findByIds(orgsWithRecht)).forEach(function (orga: OrganisationDo<true>) {
            rollen.forEach(function (rolle: Rolle<true>) {
                if (organisationMatchesRollenart.isSatisfiedBy(orga, rolle) && !allowedRollen.includes(rolle)) {
                    allowedRollen.push(rolle);
                }
            });
        });

        return limit ? allowedRollen.slice(0, limit) : allowedRollen;
    }
}
