import { Migration } from '@mikro-orm/migrations';

export class Migration20240925135339 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "rolle" add column "version" bigint not null default 1;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "rolle" drop column "version";');
  }

}
