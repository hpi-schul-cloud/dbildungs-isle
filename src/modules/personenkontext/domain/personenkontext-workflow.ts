import { RolleRepo } from '../../rolle/repo/rolle.repo.js';
import { Rolle } from '../../rolle/domain/rolle.js';
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
import { Organisation } from '../../organisation/domain/organisation.js';
import { IPersonPermissions } from '../../../shared/permissions/person-permissions.interface.js';

export class PersonenkontextWorkflowAggregate {
    public selectedOrganisationId?: string;

    public selectedRolleId?: string;

    private constructor(
        private readonly rolleRepo: RolleRepo,
        private readonly organisationRepository: OrganisationRepository,
        private readonly dbiamPersonenkontextFactory: DbiamPersonenkontextFactory,
    ) {}

    public static createNew(
        rolleRepo: RolleRepo,
        organisationRepository: OrganisationRepository,
        dbiamPersonenkontextFactory: DbiamPersonenkontextFactory,
    ): PersonenkontextWorkflowAggregate {
        return new PersonenkontextWorkflowAggregate(rolleRepo, organisationRepository, dbiamPersonenkontextFactory);
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
        organisationId?: string, // Add organisationId as an optional parameter
    ): Promise<Organisation<true>[]> {
        let allOrganisationsExceptKlassen: Organisation<boolean>[] = [];

        // If the search string for organisation is present then search for Name or Kennung
        allOrganisationsExceptKlassen =
            await this.organisationRepository.findByNameOrKennungAndExcludeByOrganisationType(
                OrganisationsTyp.KLASSE,
                organisationName,
            );

        if (allOrganisationsExceptKlassen.length === 0) return [];

        const orgsWithRecht: OrganisationID[] = await permissions.getOrgIdsWithSystemrecht(
            [RollenSystemRecht.PERSONEN_VERWALTEN],
            true,
        );

        // Return only the orgas that the admin have rights on
        let filteredOrganisations: Organisation<boolean>[] = allOrganisationsExceptKlassen.filter(
            (orga: Organisation<boolean>) => orgsWithRecht.includes(orga.id as OrganisationID),
        );

        // If organisationId is provided and it's not in the filtered results, fetch it explicitly
        if (
            this.selectedOrganisationId &&
            !filteredOrganisations.find((orga: Organisation<boolean>) => orga.id === organisationId)
        ) {
            const selectedOrg: Option<Organisation<true>> = await this.organisationRepository.findById(
                this.selectedOrganisationId,
            );
            if (selectedOrg) {
                filteredOrganisations = [selectedOrg, ...filteredOrganisations]; // Add the selected org at the beginning
            }
        }

        // Sort the filtered organizations, handling undefined kennung and name
        filteredOrganisations.sort((a: Organisation<boolean>, b: Organisation<boolean>) => {
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

        // Return the organizations that the admin has rights to
        return filteredOrganisations;
    }

    public async findRollenForOrganisation(
        permissions: PersonPermissions,
        rolleName?: string,
        limit?: number,
    ): Promise<Rolle<true>[]> {
        let rollen: Option<Rolle<true>[]>;

        if (rolleName) {
            rollen = await this.rolleRepo.findByName(rolleName, false);
        } else {
            rollen = await this.rolleRepo.find(false);
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

        let organisation: Option<Organisation<true>>;
        if (this.selectedOrganisationId) {
            // The organisation that was selected and that will be the base for the returned roles
            organisation = await this.organisationRepository.findById(this.selectedOrganisationId);
        }
        // If the organisation was not found with the provided selected Id then just return an array of empty orgas
        if (!organisation) {
            return [];
        }

        let allowedRollen: Rolle<true>[] = [];
        // If the user has rights for this specific organization or any of its children, return the filtered roles
        if (orgsWithRecht.includes(organisation.id)) {
            const allowedRollenPromises: Promise<Rolle<true> | null>[] = rollen.map(async (rolle: Rolle<true>) => {
                // Check if the rolle can be assigned to the target organisation
                const referenceCheckError: Option<DomainError> = await this.checkReferences(organisation.id, rolle.id);

                // If the reference check passes and the organisation matches the role type
                if (!referenceCheckError) {
                    return rolle;
                }
                return null;
            });

            // Resolve all the promises and filter out any null values (roles that can't be assigned)
            const resolvedRollen: Rolle<true>[] = (await Promise.all(allowedRollenPromises)).filter(
                (rolle: Rolle<true> | null): rolle is Rolle<true> => rolle !== null,
            );

            allowedRollen = resolvedRollen;
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
        lastModified: Date | undefined,
        count: number,
        personenkontexte: DbiamPersonenkontextBodyParams[],
        permissions: IPersonPermissions,
    ): Promise<Personenkontext<true>[] | PersonenkontexteUpdateError> {
        const pkUpdate: PersonenkontexteUpdate = this.dbiamPersonenkontextFactory.createNewPersonenkontexteUpdate(
            personId,
            lastModified,
            count,
            personenkontexte,
            permissions,
        );
        const updateResult: Personenkontext<true>[] | PersonenkontexteUpdateError = await pkUpdate.update();

        if (updateResult instanceof PersonenkontexteUpdateError) {
            return updateResult;
        }
        return updateResult;
    }

    // Checks if the rolle can be assigned to the target organisation
    public async checkReferences(organisationId: string, rolleId: string): Promise<Option<DomainError>> {
        const [orga, rolle]: [Option<Organisation<true>>, Option<Rolle<true>>] = await Promise.all([
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
        const hasPermissionAtOrga: boolean = await permissions.hasSystemrechteAtOrganisation(organisationId, [
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
    ): Promise<Organisation<true>[]> {
        this.selectedRolleId = rolleId;

        let organisationsFoundByName: Organisation<boolean>[] = [];

        if (excludeKlassen) {
            organisationsFoundByName =
                await this.organisationRepository.findByNameOrKennungAndExcludeByOrganisationType(
                    OrganisationsTyp.KLASSE,
                    sskName,
                );
        } else {
            organisationsFoundByName = await this.organisationRepository.findByNameOrKennung(sskName);
        }

        if (organisationsFoundByName.length === 0) return [];

        const rolleResult: Option<Rolle<true>> = await this.rolleRepo.findById(rolleId);
        if (!rolleResult) return [];

        const organisationsRoleIsAvalableIn: Organisation<true>[] = [];

        const parentOrganisation: Option<Organisation<true>> = await this.organisationRepository.findById(
            rolleResult.administeredBySchulstrukturknoten,
        );
        if (!parentOrganisation) return [];
        organisationsRoleIsAvalableIn.push(parentOrganisation);

        const childOrganisations: Organisation<true>[] = await this.organisationRepository.findChildOrgasForIds([
            rolleResult.administeredBySchulstrukturknoten,
        ]);
        organisationsRoleIsAvalableIn.push(...childOrganisations);

        let orgas: Organisation<true>[] = organisationsFoundByName.filter((ssk: Organisation<true>) =>
            organisationsRoleIsAvalableIn.some((organisation: Organisation<true>) => ssk.id === organisation.id),
        );

        const organisationMatchesRollenart: OrganisationMatchesRollenart = new OrganisationMatchesRollenart();
        orgas = orgas.filter((orga: Organisation<true>) =>
            organisationMatchesRollenart.isSatisfiedBy(orga, rolleResult),
        );

        return orgas.slice(0, limit);
    }
}
