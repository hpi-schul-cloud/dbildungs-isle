import { Migration } from '@mikro-orm/migrations';

export class Migration20241015195250 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "importdataitem" rename column "familienname" to "nachname";');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "importdataitem" rename column "nachname" to "familienname";');
  }

}
