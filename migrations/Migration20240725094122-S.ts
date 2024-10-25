import { Migration } from '@mikro-orm/migrations';

export class Migration20240725094122 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "email_address" ("id" uuid not null, "address" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "person_id" uuid null, "enabled" boolean not null, constraint "email_address_pkey" primary key ("id", "address"));');
    this.addSql('alter table "email_address" add constraint "email_address_address_unique" unique ("address");');

    this.addSql('alter table "email_address" add constraint "email_address_person_id_foreign" foreign key ("person_id") references "person" ("id") on update cascade on delete set null;');

    this.addSql('alter type "service_provider_target_enum" add value if not exists \'EMAIL\';');
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "email_address" cascade;');
  }

}
