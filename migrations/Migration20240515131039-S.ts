import { Migration } from '@mikro-orm/migrations';

export class Migration20240515131039 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "benachrichtigung" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "source" uuid not null, "target" uuid not null, constraint "benachrichtigung_pkey" primary key ("id"));');

    this.addSql('create table "data_provider" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "data_provider_pkey" primary key ("id"));');

    this.addSql('create table "authentication_provider" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "data_provider_id" uuid not null, constraint "authentication_provider_pkey" primary key ("id"));');

    this.addSql('create table "seeding" ("hash" varchar(255) not null, "status" text check ("status" in (\'STARTED\', \'DONE\', \'FAILED\')) not null, "executed_at" timestamptz not null, "path" varchar(255) null, constraint "seeding_pkey" primary key ("hash"));');

    this.addSql('create table "seeding_reference" ("virtual_id" int not null, "uuid" varchar(255) not null, "referenced_entity_type" text check ("referenced_entity_type" in (\'PERSON\', \'ORGANISATION\', \'ROLLE\', \'SERVICE_PROVIDER\')) not null, constraint "seeding_reference_pkey" primary key ("virtual_id", "uuid"));');

    this.addSql('create table "organisation" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "administriert_von" uuid null, "zugehoerig_zu" uuid null, "kennung" varchar(255) null, "name" varchar(255) null, "namensergaenzung" varchar(255) null, "kuerzel" varchar(255) null, "typ" text check ("typ" in (\'ROOT\', \'LAND\', \'TRAEGER\', \'SCHULE\', \'KLASSE\', \'ANBIETER\', \'SONSTIGE ORGANISATION / EINRICHTUNG\', \'UNBESTAETIGT\')) null, "traegerschaft" text check ("traegerschaft" in (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\')) null, constraint "organisation_pkey" primary key ("id"));');

    this.addSql('create table "person" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "keycloak_user_id" varchar(255) not null, "referrer" varchar(255) null, "mandant" varchar(255) not null, "stammorganisation" varchar(255) null, "familienname" varchar(255) not null, "vorname" varchar(255) not null, "initialen_familienname" varchar(255) null, "initialen_vorname" varchar(255) null, "rufname" varchar(255) null, "name_titel" varchar(255) null, "name_anrede" text[] null, "name_praefix" text[] null, "name_suffix" text[] null, "name_sortierindex" varchar(255) null, "geburtsdatum" timestamptz null, "geburtsort" varchar(255) null, "geschlecht" text check ("geschlecht" in (\'m\', \'w\', \'d\', \'x\')) null, "lokalisierung" varchar(255) null, "vertrauensstufe" text check ("vertrauensstufe" in (\'KEIN\', \'UNBE\', \'TEIL\', \'VOLL\')) null, "auskunftssperre" boolean null, "data_provider_id" uuid null, "revision" varchar(255) not null default \'1\', "personalnummer" varchar(255) null, constraint "person_pkey" primary key ("id"));');

    this.addSql('create table "personenkontext" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "person_id_id" uuid not null, "organisation_id" uuid null, "rolle_id" uuid null, "referrer" varchar(255) null, "mandant" varchar(255) null, "rolle" text check ("rolle" in (\'LERN\', \'LEHR\', \'EXTERN\', \'ORGADMIN\', \'LEIT\', \'SYSADMIN\')) not null, "personenstatus" text check ("personenstatus" in (\'AKTIV\')) null, "jahrgangsstufe" text check ("jahrgangsstufe" in (\'01\', \'02\', \'03\', \'04\', \'05\', \'06\', \'07\', \'08\', \'09\', \'10\')) null, "sichtfreigabe" varchar(255) null default \'nein\', "loeschung_zeitpunkt" timestamptz null, "revision" varchar(255) not null default \'1\', constraint "personenkontext_pkey" primary key ("id"));');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_organisation_id_rolle_id_unique" unique ("person_id_id", "organisation_id", "rolle_id");');

    this.addSql('create table "rolle" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "administered_by_schulstrukturknoten" uuid not null, "rollenart" text check ("rollenart" in (\'LERN\', \'LEHR\', \'EXTERN\', \'ORGADMIN\', \'LEIT\', \'SYSADMIN\')) not null, constraint "rolle_pkey" primary key ("id"));');

    this.addSql('create table "rolle_merkmal" ("rolle_id" uuid not null, "merkmal" text check ("merkmal" in (\'BEFRISTUNG_PFLICHT\', \'KOPERS_PFLICHT\')) not null, constraint "rolle_merkmal_pkey" primary key ("rolle_id", "merkmal"));');

    this.addSql('create table "rolle_systemrecht" ("rolle_id" uuid not null, "systemrecht" text check ("systemrecht" in (\'ROLLEN_VERWALTEN\', \'PERSONEN_VERWALTEN\', \'SCHULEN_VERWALTEN\', \'KLASSEN_VERWALTEN\', \'SCHULTRAEGER_VERWALTEN\')) not null, constraint "rolle_systemrecht_pkey" primary key ("rolle_id", "systemrecht"));');

    this.addSql('create table "schulstrukturknoten" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "administrative_parent_id" uuid not null, "organizational_parent_id" uuid not null, "data_provider" uuid not null, "node_type" text check ("node_type" in (\'traeger\', \'organisation\', \'group\')) not null, constraint "schulstrukturknoten_pkey" primary key ("id"));');
    this.addSql('alter table "schulstrukturknoten" add constraint "schulstrukturknoten_administrative_parent_id_unique" unique ("administrative_parent_id");');
    this.addSql('alter table "schulstrukturknoten" add constraint "schulstrukturknoten_organizational_parent_id_unique" unique ("organizational_parent_id");');
    this.addSql('create index "schulstrukturknoten_node_type_index" on "schulstrukturknoten" ("node_type");');

    this.addSql('create table "service_provider" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "target" text check ("target" in (\'URL\', \'SCHULPORTAL_ADMINISTRATION\')) not null, "url" varchar(255) null, "provided_on_schulstrukturknoten" uuid not null, "kategorie" text check ("kategorie" in (\'EMAIL\', \'UNTERRICHT\', \'VERWALTUNG\', \'HINWEISE\', \'ANGEBOTE\')) not null, "logo" bytea null, "logo_mime_type" varchar(255) null, constraint "service_provider_pkey" primary key ("id"));');

    this.addSql('create table "rolle_service_provider" ("rolle_id" uuid not null, "service_provider_id" uuid not null, constraint "rolle_service_provider_pkey" primary key ("rolle_id", "service_provider_id"));');

    this.addSql('alter table "authentication_provider" add constraint "authentication_provider_data_provider_id_foreign" foreign key ("data_provider_id") references "data_provider" ("id") on update cascade;');

    this.addSql('alter table "person" add constraint "person_data_provider_id_foreign" foreign key ("data_provider_id") references "data_provider" ("id") on update cascade on delete set null;');

    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_foreign" foreign key ("person_id_id") references "person" ("id");');

    this.addSql('alter table "rolle_merkmal" add constraint "rolle_merkmal_rolle_id_foreign" foreign key ("rolle_id") references "rolle" ("id") on update cascade;');

    this.addSql('alter table "rolle_systemrecht" add constraint "rolle_systemrecht_rolle_id_foreign" foreign key ("rolle_id") references "rolle" ("id") on update cascade;');

    this.addSql('alter table "schulstrukturknoten" add constraint "schulstrukturknoten_administrative_parent_id_foreign" foreign key ("administrative_parent_id") references "schulstrukturknoten" ("id") on update cascade;');
    this.addSql('alter table "schulstrukturknoten" add constraint "schulstrukturknoten_organizational_parent_id_foreign" foreign key ("organizational_parent_id") references "schulstrukturknoten" ("id") on update cascade;');

    this.addSql('alter table "rolle_service_provider" add constraint "rolle_service_provider_rolle_id_foreign" foreign key ("rolle_id") references "rolle" ("id") on update cascade;');
    this.addSql('alter table "rolle_service_provider" add constraint "rolle_service_provider_service_provider_id_foreign" foreign key ("service_provider_id") references "service_provider" ("id") on update cascade;');
  }

}
	