import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { DataProviderFile } from './file/data-provider-file.js';
import { OrganisationFile } from './file/organisation-file.js';
import { Rolle } from '../../modules/rolle/domain/rolle.js';
import { ConstructorCall, EntityFile } from './db-seed.console.js';
import { ServiceProvider } from '../../modules/service-provider/domain/service-provider.js';
import { Personenkontext } from '../../modules/personenkontext/domain/personenkontext.js';
import { plainToInstance } from 'class-transformer';
import { OrganisationDo } from '../../modules/organisation/domain/organisation.do.js';
import { Person, PersonCreationParams } from '../../modules/person/domain/person.js';
import { PersonFile } from './file/person-file.js';
import { PersonRepository } from '../../modules/person/persistence/person.repository.js';
import { PersonFactory } from '../../modules/person/domain/person.factory.js';
import { DomainError, EntityNotFoundError } from '../../shared/error/index.js';
import { ClassLogger } from '../../core/logging/class-logger.js';
import { ConfigService } from '@nestjs/config';
import { PersonenkontextFile } from './file/personenkontext-file.js';
import { OrganisationRepo } from '../../modules/organisation/persistence/organisation.repo.js';
import { RolleFile } from './file/rolle-file.js';
import { RolleRepo } from '../../modules/rolle/repo/rolle.repo.js';
import { RolleFactory } from '../../modules/rolle/domain/rolle.factory.js';
import { ServiceProviderFile } from './file/service-provider-file.js';
import { DBiamPersonenkontextRepo } from '../../modules/personenkontext/persistence/dbiam-personenkontext.repo.js';
import { ServiceProviderFactory } from '../../modules/service-provider/domain/service-provider.factory.js';
import { ServiceProviderRepo } from '../../modules/service-provider/repo/service-provider.repo.js';
import { ServerConfig, DataConfig } from '../../shared/config/index.js';
import { FindUserFilter, KeycloakUserService, UserDo } from '../../modules/keycloak-administration/index.js';
import { DBiamPersonenkontextService } from '../../modules/personenkontext/domain/dbiam-personenkontext.service.js';

@Injectable()
export class DbSeedService {
    private readonly ROOT_ORGANISATION_ID: string;

    public constructor(
        private readonly logger: ClassLogger,
        private readonly personFactory: PersonFactory,
        private readonly personRepository: PersonRepository,
        private readonly dBiamPersonenkontextRepo: DBiamPersonenkontextRepo,
        private readonly organisationRepo: OrganisationRepo,
        private readonly rolleRepo: RolleRepo,
        private readonly rolleFactory: RolleFactory,
        private readonly serviceProviderRepo: ServiceProviderRepo,
        private readonly serviceProviderFactory: ServiceProviderFactory,
        private readonly kcUserService: KeycloakUserService,
        private readonly dbiamPersonenkontextService: DBiamPersonenkontextService,
        config: ConfigService<ServerConfig>,
    ) {
        this.ROOT_ORGANISATION_ID = config.getOrThrow<DataConfig>('DATA').ROOT_ORGANISATION_ID;
    }

    private dataProviderMap: Map<string, DataProviderFile> = new Map<string, DataProviderFile>();

    private organisationMap: Map<number, OrganisationDo<true>> = new Map();

    private personMap: Map<number, Person<true>> = new Map();

    private rolleMap: Map<number, Rolle<true>> = new Map();

    private serviceProviderMap: Map<number, ServiceProvider<true>> = new Map();

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

    //to be refactored when organisation becomes DomainDriven
    private async constructAndPersistOrganisation(data: OrganisationFile): Promise<OrganisationDo<true>> {
        const organisationDo: OrganisationDo<true> = new OrganisationDo<true>();
        let administriertVon: string | undefined = undefined;
        let zugehoerigZu: string | undefined = undefined;

        if (data.administriertVon != null) {
            const adminstriertVonOrganisation: OrganisationDo<true> = this.getReferencedOrganisation(
                data.administriertVon,
            );
            administriertVon = adminstriertVonOrganisation.id;
        }
        if (data.zugehoerigZu != null) {
            const zugehoerigZuOrganisation: OrganisationDo<true> = this.getReferencedOrganisation(data.zugehoerigZu);
            zugehoerigZu = zugehoerigZuOrganisation.id;
        }

        if (!administriertVon && !zugehoerigZu && data.kuerzel === 'Root') {
            organisationDo.id = this.ROOT_ORGANISATION_ID;
        }

        organisationDo.administriertVon = administriertVon ?? undefined;
        organisationDo.zugehoerigZu = zugehoerigZu ?? undefined;
        organisationDo.kennung = data.kennung ?? undefined;
        organisationDo.name = data.name ?? undefined;
        organisationDo.namensergaenzung = data.namensergaenzung ?? undefined;
        organisationDo.kuerzel = data.kuerzel ?? undefined;
        organisationDo.typ = data.typ ?? undefined;
        organisationDo.traegerschaft = data.traegerschaft ?? undefined;

        const persistedOrganisation: OrganisationDo<true> = await this.organisationRepo.save(organisationDo);
        this.organisationMap.set(data.id, persistedOrganisation);

        return organisationDo;
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
            const rolle: Rolle<false> = this.rolleFactory.createNew(
                file.name,
                this.getReferencedOrganisation(file.administeredBySchulstrukturknoten).id,
                file.rollenart,
                file.merkmale,
                file.systemrechte,
                file.serviceProviderIds
                    ? this.getReferencedServiceProviders(file.serviceProviderIds).map(
                          (sp: ServiceProvider<true>) => sp.id,
                      )
                    : undefined,
            );

            const persistedRolle: Rolle<true> | DomainError = await this.rolleRepo.save(rolle);
            if (file.id != null) {
                this.rolleMap.set(file.id, persistedRolle);
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
            const serviceProvider: ServiceProvider<false> = this.serviceProviderFactory.createNew(
                file.name,
                file.target,
                file.url,
                file.kategorie,
                this.getReferencedOrganisation(file.providedOnSchulstrukturknoten).id,
                file.logoBase64 ? Buffer.from(file.logoBase64, 'base64') : undefined,
                file.logoMimeType,
            );

            const persistedServiceProvider: ServiceProvider<true> =
                await this.serviceProviderRepo.save(serviceProvider);
            if (file.id != null) {
                this.serviceProviderMap.set(file.id, persistedServiceProvider);
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

            const existingKcUser: Result<UserDo<true>, DomainError> = await this.kcUserService.findOne(filter);
            if (existingKcUser.ok) {
                await this.kcUserService.delete(existingKcUser.value.id); //When kcUser exists delete it
                this.logger.warning(
                    `Keycloak User with keycloakid: ${existingKcUser.value.id} has been deleted, and will be replaced by newly seeded user with same username: ${person.username}`,
                );
            }

            const persistedPerson: Person<true> | DomainError = await this.personRepository.create(person);
            if (persistedPerson instanceof Person && file.id != null) {
                this.personMap.set(file.id, persistedPerson);
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
            const personenKontext: Personenkontext<false> = Personenkontext.construct(
                undefined,
                new Date(),
                new Date(),
                this.getReferencedPerson(file.personId).id,
                this.getReferencedOrganisation(file.organisationId).id,
                this.getReferencedRolle(file.rolleId).id,
            );

            //Check specifications
            const specificationCheckError: Option<DomainError> =
                await this.dbiamPersonenkontextService.checkSpecifications(personenKontext);
            if (specificationCheckError) {
                throw specificationCheckError;
            }

            persistedPersonenkontexte.push(await this.dBiamPersonenkontextRepo.save(personenKontext));
            //at the moment no saving of Personenkontext in a map for referencing
        }
        this.logger.info(`Insert ${files.length} entities of type Personenkontext`);
        return persistedPersonenkontexte;
    }

    private getReferencedPerson(seedingId: number): Person<true> {
        const person: Person<true> | undefined = this.personMap.get(seedingId);
        if (!person) throw new EntityNotFoundError('Person', seedingId.toString());
        return person;
    }

    private getReferencedOrganisation(seedingId: number): OrganisationDo<true> {
        const organisation: OrganisationDo<true> | undefined = this.organisationMap.get(seedingId);
        if (!organisation) throw new EntityNotFoundError('Organisation', seedingId.toString());
        return organisation;
    }

    private getReferencedRolle(seedingId: number): Rolle<true> {
        const rolle: Rolle<true> | undefined = this.rolleMap.get(seedingId);
        if (!rolle) throw new EntityNotFoundError('Rolle', seedingId.toString());
        return rolle;
    }

    private getReferencedServiceProviders(seedingIds: number[]): ServiceProvider<true>[] {
        return seedingIds.map((n: number) => this.getReferencedServiceProvider(n));
    }

    private getReferencedServiceProvider(seedingId: number): ServiceProvider<true> {
        const serviceProvider: ServiceProvider<true> | undefined = this.serviceProviderMap.get(seedingId);
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

    public getEntityFileNames(directory: string): string[] {
        return fs.readdirSync(`./seeding/${directory}`).filter((fileName: string) => fileName.endsWith('.json'));
    }
}
