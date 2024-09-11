/* eslint-disable no-console */
import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { DataProviderFile } from '../file/data-provider-file.js';
import { OrganisationFile } from '../file/organisation-file.js';
import { Rolle } from '../../../modules/rolle/domain/rolle.js';
import { ConstructorCall, EntityFile } from '../db-seed.console.js';
import { ServiceProvider } from '../../../modules/service-provider/domain/service-provider.js';
import { Personenkontext } from '../../../modules/personenkontext/domain/personenkontext.js';
import { plainToInstance } from 'class-transformer';
import { Person, PersonCreationParams } from '../../../modules/person/domain/person.js';
import { PersonFile } from '../file/person-file.js';
import { PersonRepository } from '../../../modules/person/persistence/person.repository.js';
import { PersonFactory } from '../../../modules/person/domain/person.factory.js';
import { DomainError, EntityNotFoundError } from '../../../shared/error/index.js';
import { ClassLogger } from '../../../core/logging/class-logger.js';
import { ConfigService } from '@nestjs/config';
import { PersonenkontextFile } from '../file/personenkontext-file.js';
import { RolleFile } from '../file/rolle-file.js';
import { RolleRepo } from '../../../modules/rolle/repo/rolle.repo.js';
import { RolleFactory } from '../../../modules/rolle/domain/rolle.factory.js';
import { ServiceProviderFile } from '../file/service-provider-file.js';
import { DBiamPersonenkontextRepo } from '../../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { ServiceProviderFactory } from '../../../modules/service-provider/domain/service-provider.factory.js';
import { ServiceProviderRepo } from '../../../modules/service-provider/repo/service-provider.repo.js';
import { DataConfig, ServerConfig } from '../../../shared/config/index.js';
import { FindUserFilter, KeycloakUserService, User } from '../../../modules/keycloak-administration/index.js';
import { DBiamPersonenkontextService } from '../../../modules/personenkontext/domain/dbiam-personenkontext.service.js';
import { DbSeedReferenceRepo } from '../repo/db-seed-reference.repo.js';
import { DbSeedReference } from './db-seed-reference.js';
import { ReferencedEntityType } from '../repo/db-seed-reference.entity.js';
import { PersonenkontextFactory } from '../../../modules/personenkontext/domain/personenkontext.factory.js';
import { OrganisationRepository } from '../../../modules/organisation/persistence/organisation.repository.js';
import { Organisation } from '../../../modules/organisation/domain/organisation.js';
import { RollenMerkmal } from '../../../modules/rolle/domain/rolle.enums.js';

@Injectable()
export class DbSeedService {
    private readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly personFactory: PersonFactory,
        private readonly personRepository: PersonRepository,
        private readonly dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly organisationRepository: OrganisationRepository,
        private readonly rolleRepo: RolleRepo,
        private readonly rolleFactory: RolleFactory,
        private readonly serviceProviderRepo: ServiceProviderRepo,
        private readonly serviceProviderFactory: ServiceProviderFactory,
        private readonly kcUserService: KeycloakUserService,
        private readonly dbiamPersonenkontextService: DBiamPersonenkontextService,
        private readonly dbSeedReferenceRepo: DbSeedReferenceRepo,
        private readonly personenkontextFactory: PersonenkontextFactory,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    private dataProviderMap: Map<string, DataProviderFile> = new Map<string, DataProviderFile>();

    public readDataProvider(fileContentAsStr: string): DataProviderFile[] {
        const entities: DataProviderFile[] = this.readEntityFromJSONFile<DataProviderFile>(
            fileContentAsStr,
            () => new DataProviderFile(),
        );
        for (const entity of entities) {
            this.dataProviderMap.set(entity.id, entity);
        }
        return entities;
    }

    private async constructAndPersistOrganisation(data: OrganisationFile): Promise<Organisation<true>> {
        let administriertVon: string | undefined = undefined;
        let zugehoerigZu: string | undefined = undefined;

        if (data.administriertVon != null) {
            const adminstriertVonOrganisation: Organisation<true> = await this.getReferencedOrganisation(
                data.administriertVon,
            );
            administriertVon = adminstriertVonOrganisation.id;
        }
        if (data.zugehoerigZu != null) {
            const zugehoerigZuOrganisation: Organisation<true> = await this.getReferencedOrganisation(
                data.zugehoerigZu,
            );
            zugehoerigZu = zugehoerigZuOrganisation.id;
        }

        const organisation: Organisation<false> | DomainError = Organisation.createNew(
            administriertVon,
            zugehoerigZu,
            data.kennung,
            data.name,
            data.namensergaenzung,
            data.kuerzel,
            data.typ,
            data.traegerschaft,
        );

        if (organisation instanceof DomainError) {
            throw organisation;
        }

        if (!administriertVon && !zugehoerigZu && data.kuerzel === 'Root') {
            organisation.id = this.ROOT_ORGANISATION_ID;
        }

        const savedOrga: Organisation<true> = await this.organisationRepository.saveSeedData(organisation);
        const dbSeedReference: DbSeedReference = DbSeedReference.createNew(
            ReferencedEntityType.ORGANISATION,
            data.id,
            savedOrga.id,
        );
        await this.dbSeedReferenceRepo.create(dbSeedReference);

        return savedOrga;
    }

    public async seedOrganisation(fileContentAsStr: string): Promise<void> {
        const organisationFile: EntityFile<OrganisationFile> = JSON.parse(
            fileContentAsStr,
        ) as EntityFile<OrganisationFile>;

        const entities: OrganisationFile[] = plainToInstance(OrganisationFile, organisationFile.entities);

        for (const organisation of entities) {
            await this.constructAndPersistOrganisation(organisation);
        }
        this.logger.info(`Insert ${entities.length} entities of type Organisation`);
    }

    public async seedRolle(fileContentAsStr: string): Promise<void> {
        const rolleFile: EntityFile<RolleFile> = JSON.parse(fileContentAsStr) as EntityFile<RolleFile>;
        const files: RolleFile[] = plainToInstance(RolleFile, rolleFile.entities);
        for (const file of files) {
            const serviceProviderUUIDs: string[] = [];
            for (const spId of file.serviceProviderIds) {
                const sp: ServiceProvider<true> = await this.getReferencedServiceProvider(spId);
                serviceProviderUUIDs.push(sp.id);
            }
            const referencedOrga: Organisation<true> = await this.getReferencedOrganisation(
                file.administeredBySchulstrukturknoten,
            );
            const rolle: Rolle<false> | DomainError = this.rolleFactory.createNew(
                file.name,
                referencedOrga.id,
                file.rollenart,
                file.merkmale,
                file.systemrechte,
                serviceProviderUUIDs,
                file.istTechnisch ?? false,
            );

            if (rolle instanceof DomainError) {
                throw rolle;
            }

            const persistedRolle: Rolle<true> = await this.rolleRepo.save(rolle);
            if (persistedRolle && file.id != null) {
                const dbSeedReference: DbSeedReference = DbSeedReference.createNew(
                    ReferencedEntityType.ROLLE,
                    file.id,
                    persistedRolle.id,
                );
                await this.dbSeedReferenceRepo.create(dbSeedReference);
            } else {
                this.logger.error('Rolle without ID thus not referenceable:');
                this.logger.error(JSON.stringify(rolle));
            }
        }
        this.logger.info(`Insert ${files.length} entities of type Rolle`);
    }

    public async seedServiceProvider(fileContentAsStr: string): Promise<void> {
        const serviceProviderFile: EntityFile<ServiceProviderFile> = JSON.parse(
            fileContentAsStr,
        ) as EntityFile<ServiceProviderFile>;
        const files: ServiceProviderFile[] = plainToInstance(ServiceProviderFile, serviceProviderFile.entities);
        for (const file of files) {
            const referencedOrga: Organisation<true> = await this.getReferencedOrganisation(
                file.providedOnSchulstrukturknoten,
            );
            const serviceProvider: ServiceProvider<false> = this.serviceProviderFactory.createNew(
                file.name,
                file.target,
                file.url,
                file.kategorie,
                referencedOrga.id,
                file.logoBase64 ? Buffer.from(file.logoBase64, 'base64') : undefined,
                file.logoMimeType,
                file.keycloakGroup,
                file.keycloakRole,
            );

            const persistedServiceProvider: ServiceProvider<true> =
                await this.serviceProviderRepo.save(serviceProvider);
            if (persistedServiceProvider && file.id != null) {
                const dbSeedReference: DbSeedReference = DbSeedReference.createNew(
                    ReferencedEntityType.SERVICE_PROVIDER,
                    file.id,
                    persistedServiceProvider.id,
                );
                await this.dbSeedReferenceRepo.create(dbSeedReference);
            } else {
                this.logger.error('ServiceProvider without ID thus not referenceable:');
                this.logger.error(JSON.stringify(serviceProvider));
            }
        }
        this.logger.info(`Insert ${files.length} entities of type ServiceProvider`);
    }

    public async seedPerson(fileContentAsStr: string): Promise<void> {
        const personFile: EntityFile<PersonFile> = JSON.parse(fileContentAsStr) as EntityFile<PersonFile>;
        const files: PersonFile[] = plainToInstance(PersonFile, personFile.entities);
        for (const file of files) {
            const creationParams: PersonCreationParams = {
                familienname: file.familienname,
                vorname: file.vorname,
                referrer: file.referrer,
                stammorganisation: file.stammorganisation,
                initialenFamilienname: file.initialenFamilienname,
                initialenVorname: file.initialenVorname,
                rufname: file.rufname,
                nameTitel: file.nameTitel,
                nameAnrede: file.nameAnrede,
                namePraefix: file.namePraefix,
                nameSuffix: file.nameSuffix,
                nameSortierindex: file.nameSortierindex,
                geburtsdatum: file.geburtsdatum,
                geburtsort: file.geburtsort,
                geschlecht: file.geschlecht,
                lokalisierung: file.lokalisierung,
                vertrauensstufe: file.vertrauensstufe,
                auskunftssperre: file.auskunftssperre,
                username: file.username,
                password: file.password,
                personalnummer: file.personalnummer,
            };
            const person: Person<false> | DomainError = await this.personFactory.createNew(creationParams);
            if (person instanceof DomainError) {
                this.logger.error('Could not create person:');
                this.logger.error(JSON.stringify(person));
                throw person;
            }
            const filter: FindUserFilter = {
                username: person.username,
            };

            const existingKcUser: Result<User<true>, DomainError> = await this.kcUserService.findOne(filter);
            if (existingKcUser.ok) {
                await this.kcUserService.delete(existingKcUser.value.id); //When kcUser exists delete it
                this.logger.warning(
                    `Keycloak User with keycloakid: ${existingKcUser.value.id} has been deleted, and will be replaced by newly seeded user with same username: ${person.username}`,
                );
            }
            const persistedPerson: Person<true> | DomainError = await this.personRepository.create(person);
            if (persistedPerson instanceof Person && file.id != null) {
                const dbSeedReference: DbSeedReference = DbSeedReference.createNew(
                    ReferencedEntityType.PERSON,
                    file.id,
                    persistedPerson.id,
                );
                await this.dbSeedReferenceRepo.create(dbSeedReference);
            } else {
                this.logger.error('Person without ID thus not referenceable:');
                this.logger.error(JSON.stringify(person));
            }
        }
        this.logger.info(`Insert ${files.length} entities of type Person`);
    }

    public async seedPersonenkontext(fileContentAsStr: string): Promise<Personenkontext<true>[]> {
        const personenkontextFile: EntityFile<PersonenkontextFile> = JSON.parse(
            fileContentAsStr,
        ) as EntityFile<PersonenkontextFile>;

        const files: PersonenkontextFile[] = plainToInstance(PersonenkontextFile, personenkontextFile.entities);
        const persistedPersonenkontexte: Personenkontext<true>[] = [];
        for (const file of files) {
            const referencedPerson: Person<true> = await this.getReferencedPerson(file.personId);
            const referencedOrga: Organisation<true> = await this.getReferencedOrganisation(file.organisationId);
            const referencedRolle: Rolle<true> = await this.getReferencedRolle(file.rolleId);

            let befristung: Date | undefined = undefined;
            console.log(referencedRolle.merkmale);
            console.log(typeof referencedRolle.merkmale);
            const hasBefristungPflicht: boolean = referencedRolle.merkmale?.some(
                (merkmal: RollenMerkmal) => merkmal === RollenMerkmal.BEFRISTUNG_PFLICHT,
            );
            if (hasBefristungPflicht) {
                befristung = new Date(2099, 1, 1, 0, 1, 0); // In consultation with Kristoff, Kiefer (Cap): Set Befristung fixed to Date far in future
            }

            const personenKontext: Personenkontext<false> = this.personenkontextFactory.construct(
                undefined,
                new Date(),
                new Date(),
                undefined,
                referencedPerson.id,
                referencedOrga.id,
                referencedRolle.id,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                befristung,
            );

            //Check specifications
            const specificationCheckError: Option<DomainError> =
                await this.dbiamPersonenkontextService.checkSpecifications(personenKontext);
            if (specificationCheckError) {
                throw specificationCheckError;
            }

            persistedPersonenkontexte.push(await this.dBiamPersonenkontextRepo.save(personenKontext));
            //at the moment no saving of Personenkontext
        }
        this.logger.info(`Insert ${files.length} entities of type Personenkontext`);

        return persistedPersonenkontexte;
    }

    private async getReferencedPerson(seedingId: number): Promise<Person<true>> {
        const personUUID: Option<string> = await this.dbSeedReferenceRepo.findUUID(
            seedingId,
            ReferencedEntityType.PERSON,
        );
        if (!personUUID) throw new EntityNotFoundError('Person', seedingId.toString());
        const person: Option<Person<true>> = await this.personRepository.findById(personUUID);
        if (!person) throw new EntityNotFoundError('Person', seedingId.toString());

        return person;
    }

    private async getReferencedOrganisation(seedingId: number): Promise<Organisation<true>> {
        const organisationUUID: Option<string> = await this.dbSeedReferenceRepo.findUUID(
            seedingId,
            ReferencedEntityType.ORGANISATION,
        );
        if (!organisationUUID) throw new EntityNotFoundError('Organisation', seedingId.toString());
        const organisation: Option<Organisation<true>> = await this.organisationRepository.findById(organisationUUID);
        if (!organisation) throw new EntityNotFoundError('Organisation', seedingId.toString());

        return organisation;
    }

    private async getReferencedRolle(seedingId: number): Promise<Rolle<true>> {
        const rolleUUID: Option<string> = await this.dbSeedReferenceRepo.findUUID(
            seedingId,
            ReferencedEntityType.ROLLE,
        );
        if (!rolleUUID) throw new EntityNotFoundError('Rolle', seedingId.toString());
        const rolle: Option<Rolle<true>> = await this.rolleRepo.findById(rolleUUID);
        if (!rolle) throw new EntityNotFoundError('Rolle', seedingId.toString());

        return rolle;
    }

    private async getReferencedServiceProvider(seedingId: number): Promise<ServiceProvider<true>> {
        const serviceProviderUUID: Option<string> = await this.dbSeedReferenceRepo.findUUID(
            seedingId,
            ReferencedEntityType.SERVICE_PROVIDER,
        );
        if (!serviceProviderUUID) throw new EntityNotFoundError('ServiceProvider', seedingId.toString());
        const serviceProvider: Option<ServiceProvider<true>> =
            await this.serviceProviderRepo.findById(serviceProviderUUID);
        if (!serviceProvider) throw new EntityNotFoundError('ServiceProvider', seedingId.toString());

        return serviceProvider;
    }

    private readEntityFromJSONFile<T>(fileContentAsStr: string, constructor: ConstructorCall): T[] {
        const entityFile: EntityFile<T> = JSON.parse(fileContentAsStr) as EntityFile<T>;
        const key: keyof EntityFile<T> = 'entities';
        const entities: T[] = entityFile[key];
        const entityList: T[] = [];
        entities.forEach((entity: T) => {
            const newEntity: T = Object.assign(constructor(), entity);
            entityList.push(newEntity);
        });
        return entityList;
    }

    public getEntityFileNames(directory: string, subDir: string): string[] {
        return fs
            .readdirSync(`./seeding/${directory}/${subDir}`)
            .filter((fileName: string) => fileName.endsWith('.json'));
    }

    public getDirectories(directory: string): string[] {
        const path: string = `./seeding/${directory}`;
        return fs.readdirSync(path).filter(function (file: string) {
            return fs.statSync(path + '/' + file).isDirectory();
        });
    }
}
