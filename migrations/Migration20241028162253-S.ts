import { Migration } from '@mikro-orm/migrations';

export class Migration20241028162253 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "organisation" add column "version" bigint not null default 1;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "organisation" drop column "version";');
  }

}
