import { Migration } from '@mikro-orm/migrations';

export class Migration20241016095048 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "importdataitem" add column "validation_errors" text[] null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "importdataitem" drop column "validation_errors";');
  }

}
