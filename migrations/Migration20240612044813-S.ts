import { Migration } from '@mikro-orm/migrations';

export class Migration20240612044813 extends Migration {

  async up(): Promise<void> {
    this.addSql('create type "db_seed_status_enum" as enum (\'STARTED\', \'DONE\', \'FAILED\');');
    this.addSql('create type "referenced_entity_type_enum" as enum (\'PERSON\', \'ORGANISATION\', \'ROLLE\', \'SERVICE_PROVIDER\');');
    this.addSql('create type "organisations_typ_enum" as enum (\'ROOT\', \'LAND\', \'TRAEGER\', \'SCHULE\', \'KLASSE\', \'ANBIETER\', \'SONSTIGE ORGANISATION / EINRICHTUNG\', \'UNBESTAETIGT\');');
    this.addSql('create type "traegerschaft_enum" as enum (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\');');
    this.addSql('create type "geschlecht_enum" as enum (\'m\', \'w\', \'d\', \'x\');');
    this.addSql('create type "vertrauensstufe_enum" as enum (\'KEIN\', \'UNBE\', \'TEIL\', \'VOLL\');');
    this.addSql('create type "personenstatus_enum" as enum (\'AKTIV\');');
    this.addSql('create type "jahrgangsstufe_enum" as enum (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\', \'07\', \'08\', \'09\', \'10\');');
    this.addSql('create type "rollen_art_enum" as enum (\'LERN\', \'LEHR\', \'EXTERN\', \'ORGADMIN\', \'LEIT\', \'SYSADMIN\');');
    this.addSql('create type "rollen_merkmal_enum" as enum (\'BEFRISTUNG_PFLICHT\', \'KOPERS_PFLICHT\');');
    this.addSql('create type "rollen_system_recht_enum" as enum (\'ROLLEN_VERWALTEN\', \'PERSONEN_SOFORT_LOESCHEN\', \'PERSONEN_VERWALTEN\', \'SCHULEN_VERWALTEN\', \'KLASSEN_VERWALTEN\', \'SCHULTRAEGER_VERWALTEN\', \'MIGRATION_DURCHFUEHREN\');');
    this.addSql('create type "service_provider_target_enum" as enum (\'URL\', \'SCHULPORTAL_ADMINISTRATION\');');
    this.addSql('create type "service_provider_kategorie_enum" as enum (\'EMAIL\', \'UNTERRICHT\', \'VERWALTUNG\', \'HINWEISE\', \'ANGEBOTE\');');
    this.addSql('drop table if exists "fake" cascade;');

    this.addSql('alter table "seeding" drop constraint if exists "seeding_status_check";');

    this.addSql('alter table "seeding_reference" drop constraint if exists "seeding_reference_referenced_entity_type_check";');

    this.addSql('alter table "organisation" drop constraint if exists "organisation_typ_check";');
    this.addSql('alter table "organisation" drop constraint if exists "organisation_traegerschaft_check";');

    this.addSql('alter table "person" drop constraint if exists "person_geschlecht_check";');
    this.addSql('alter table "person" drop constraint if exists "person_vertrauensstufe_check";');

    this.addSql('alter table "personenkontext" drop constraint if exists "personenkontext_personenstatus_check";');
    this.addSql('alter table "personenkontext" drop constraint if exists "personenkontext_jahrgangsstufe_check";');

    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_id_foreign";');

    this.addSql('alter table "rolle" drop constraint if exists "rolle_rollenart_check";');

    this.addSql('alter table "rolle_merkmal" drop constraint if exists "rolle_merkmal_merkmal_check";');

    this.addSql('alter table "rolle_systemrecht" drop constraint if exists "rolle_systemrecht_systemrecht_check";');

    this.addSql('alter table "service_provider" drop constraint if exists "service_provider_target_check";');
    this.addSql('alter table "service_provider" drop constraint if exists "service_provider_kategorie_check";');

    this.addSql('alter table "seeding" alter column "status" type "db_seed_status_enum" using ("status"::"db_seed_status_enum");');

    this.addSql('alter table "seeding_reference" alter column "referenced_entity_type" type "referenced_entity_type_enum" using ("referenced_entity_type"::"referenced_entity_type_enum");');

    this.addSql('alter table "organisation" alter column "typ" type "organisations_typ_enum" using ("typ"::"organisations_typ_enum");');
    this.addSql('alter table "organisation" alter column "traegerschaft" type "traegerschaft_enum" using ("traegerschaft"::"traegerschaft_enum");');

    this.addSql('alter table "person" alter column "geschlecht" type "geschlecht_enum" using ("geschlecht"::"geschlecht_enum");');
    this.addSql('alter table "person" alter column "vertrauensstufe" type "vertrauensstufe_enum" using ("vertrauensstufe"::"vertrauensstufe_enum");');

    this.addSql('alter table "personenkontext" alter column "personenstatus" type "personenstatus_enum" using ("personenstatus"::"personenstatus_enum");');
    this.addSql('alter table "personenkontext" alter column "jahrgangsstufe" type "jahrgangsstufe_enum" using ("jahrgangsstufe"::"jahrgangsstufe_enum");');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_foreign" foreign key ("person_id_id") references "person" ("id") on delete cascade;');

    this.addSql('alter table "rolle" alter column "rollenart" type "rollen_art_enum" using ("rollenart"::"rollen_art_enum");');

    this.addSql('alter table "rolle_merkmal" alter column "merkmal" type "rollen_merkmal_enum" using ("merkmal"::"rollen_merkmal_enum");');

    this.addSql('alter table "rolle_systemrecht" alter column "systemrecht" type "rollen_system_recht_enum" using ("systemrecht"::"rollen_system_recht_enum");');

    this.addSql('alter table "service_provider" alter column "target" type "service_provider_target_enum" using ("target"::"service_provider_target_enum");');
    this.addSql('alter table "service_provider" alter column "kategorie" type "service_provider_kategorie_enum" using ("kategorie"::"service_provider_kategorie_enum");');
  }

    override async down(): Promise<void> {
    this.addSql('create table "fake" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "source" uuid not null, "target" uuid not null, constraint "fake_pkey" primary key ("id"));');

    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_id_foreign";');

    this.addSql('alter table "seeding" alter column "status" type text using ("status"::text);');
    this.addSql('alter table "seeding" add constraint "seeding_status_check" check("status" in (\'STARTED\', \'DONE\', \'FAILED\'));');

    this.addSql('alter table "seeding_reference" alter column "referenced_entity_type" type text using ("referenced_entity_type"::text);');
    this.addSql('alter table "seeding_reference" add constraint "seeding_reference_referenced_entity_type_check" check("referenced_entity_type" in (\'PERSON\', \'ORGANISATION\', \'ROLLE\', \'SERVICE_PROVIDER\'));');

    this.addSql('alter table "organisation" alter column "typ" type text using ("typ"::text);');
    this.addSql('alter table "organisation" alter column "traegerschaft" type text using ("traegerschaft"::text);');
    this.addSql('alter table "organisation" add constraint "organisation_typ_check" check("typ" in (\'ROOT\', \'LAND\', \'TRAEGER\', \'SCHULE\', \'KLASSE\', \'ANBIETER\', \'SONSTIGE ORGANISATION / EINRICHTUNG\', \'UNBESTAETIGT\'));');
    this.addSql('alter table "organisation" add constraint "organisation_traegerschaft_check" check("traegerschaft" in (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\'));');

    this.addSql('alter table "person" alter column "geschlecht" type text using ("geschlecht"::text);');
    this.addSql('alter table "person" alter column "vertrauensstufe" type text using ("vertrauensstufe"::text);');
    this.addSql('alter table "person" add constraint "person_geschlecht_check" check("geschlecht" in (\'m\', \'w\', \'d\', \'x\'));');
    this.addSql('alter table "person" add constraint "person_vertrauensstufe_check" check("vertrauensstufe" in (\'KEIN\', \'UNBE\', \'TEIL\', \'VOLL\'));');

    this.addSql('alter table "personenkontext" alter column "personenstatus" type text using ("personenstatus"::text);');
    this.addSql('alter table "personenkontext" alter column "jahrgangsstufe" type text using ("jahrgangsstufe"::text);');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_personenstatus_check" check("personenstatus" in (\'AKTIV\'));');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_jahrgangsstufe_check" check("jahrgangsstufe" in (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\', \'07\', \'08\', \'09\', \'10\'));');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_foreign" foreign key ("person_id_id") references "person" ("id");');

    this.addSql('alter table "rolle" alter column "rollenart" type text using ("rollenart"::text);');
    this.addSql('alter table "rolle" add constraint "rolle_rollenart_check" check("rollenart" in (\'LERN\', \'LEHR\', \'EXTERN\', \'ORGADMIN\', \'LEIT\', \'SYSADMIN\'));');

    this.addSql('alter table "rolle_merkmal" alter column "merkmal" type text using ("merkmal"::text);');
    this.addSql('alter table "rolle_merkmal" add constraint "rolle_merkmal_merkmal_check" check("merkmal" in (\'BEFRISTUNG_PFLICHT\', \'KOPERS_PFLICHT\'));');

    this.addSql('alter table "rolle_systemrecht" alter column "systemrecht" type text using ("systemrecht"::text);');
    this.addSql('alter table "rolle_systemrecht" add constraint "rolle_systemrecht_systemrecht_check" check("systemrecht" in (\'ROLLEN_VERWALTEN\', \'PERSONEN_VERWALTEN\', \'SCHULEN_VERWALTEN\', \'KLASSEN_VERWALTEN\', \'SCHULTRAEGER_VERWALTEN\'));');

    this.addSql('alter table "service_provider" alter column "target" type text using ("target"::text);');
    this.addSql('alter table "service_provider" alter column "kategorie" type text using ("kategorie"::text);');
    this.addSql('alter table "service_provider" add constraint "service_provider_target_check" check("target" in (\'URL\', \'SCHULPORTAL_ADMINISTRATION\'));');
    this.addSql('alter table "service_provider" add constraint "service_provider_kategorie_check" check("kategorie" in (\'EMAIL\', \'UNTERRICHT\', \'VERWALTUNG\', \'HINWEISE\', \'ANGEBOTE\'));');

    this.addSql('drop type "db_seed_status_enum";');
    this.addSql('drop type "referenced_entity_type_enum";');
    this.addSql('drop type "organisations_typ_enum";');
    this.addSql('drop type "traegerschaft_enum";');
    this.addSql('drop type "geschlecht_enum";');
    this.addSql('drop type "vertrauensstufe_enum";');
    this.addSql('drop type "personenstatus_enum";');
    this.addSql('drop type "jahrgangsstufe_enum";');
    this.addSql('drop type "rollen_art_enum";');
    this.addSql('drop type "rollen_merkmal_enum";');
    this.addSql('drop type "rollen_system_recht_enum";');
    this.addSql('drop type "service_provider_target_enum";');
    this.addSql('drop type "service_provider_kategorie_enum";');
  }

}