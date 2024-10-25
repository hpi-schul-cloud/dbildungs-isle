import { Migration } from '@mikro-orm/migrations';

export class Migration20240709101515 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_id_foreign";');

    this.addSql('alter type "organisations_typ_enum" add value if not exists \'SONSTIGE ORGANISATION / EINRICHTUNG\';');

    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_id_organisation_id_rolle_id_unique";');

    this.addSql('alter table "personenkontext" alter column "rolle_id" drop default;');
    this.addSql('alter table "personenkontext" alter column "rolle_id" type uuid using ("rolle_id"::text::uuid);');
    this.addSql('alter table "personenkontext" alter column "rolle_id" set not null;');
    this.addSql('alter table "personenkontext" rename column "person_id_id" to "person_id";');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_foreign" foreign key ("person_id") references "person" ("id") on delete cascade;');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_rolle_id_foreign" foreign key ("rolle_id") references "rolle" ("id") on update cascade;');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_organisation_id_rolle_id_unique" unique ("person_id", "organisation_id", "rolle_id");');

    this.addSql('alter table "service_provider" add column "keycloak_group" varchar(255) null, add column "keycloak_role" varchar(255) null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_foreign";');
    this.addSql('alter table "personenkontext" drop constraint "personenkontext_rolle_id_foreign";');

    this.addSql('alter type "organisations_typ_enum" add value if not exists \'"SONSTIGE ORGANISATION / EINRICHTUNG"\';');

    this.addSql('alter table "personenkontext" drop constraint "personenkontext_person_id_organisation_id_rolle_id_unique";');

    this.addSql('alter table "personenkontext" alter column "rolle_id" drop default;');
    this.addSql('alter table "personenkontext" alter column "rolle_id" type uuid using ("rolle_id"::text::uuid);');
    this.addSql('alter table "personenkontext" alter column "rolle_id" drop not null;');
    this.addSql('alter table "personenkontext" rename column "person_id" to "person_id_id";');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_foreign" foreign key ("person_id_id") references "person" ("id") on update no action on delete cascade;');
    this.addSql('alter table "personenkontext" add constraint "personenkontext_person_id_id_organisation_id_rolle_id_unique" unique ("person_id_id", "organisation_id", "rolle_id");');

    this.addSql('alter table "service_provider" drop column "keycloak_group", drop column "keycloak_role";');
  }

}
