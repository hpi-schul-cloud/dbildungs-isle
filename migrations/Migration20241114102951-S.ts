import { Migration } from '@mikro-orm/migrations';

export class Migration20241114102951 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "organisation" add column "itslearning_enabled" boolean not null default false;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "organisation" drop column "itslearning_enabled";');
  }

}
