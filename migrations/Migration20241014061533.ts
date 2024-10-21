import { Migration } from '@mikro-orm/migrations';

export class Migration20241014061533 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "importdataitem" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "importvorgang_id" uuid not null, "familienname" varchar(255) not null, "vorname" varchar(255) not null, "klasse" varchar(255) null, "personalnummer" varchar(255) null, constraint "importdataitem_pkey" primary key ("id"));');

    this.addSql('alter type "email_address_status_enum" add value if not exists \'FAILED\';');

    this.addSql('alter type "rollen_system_recht_enum" add value if not exists \'IMPORT_DURCHFUEHREN\';');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "importdataitem" cascade;');
  }

}
