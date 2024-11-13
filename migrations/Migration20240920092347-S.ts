import { Migration } from '@mikro-orm/migrations';

export class Migration20240920092347 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "organisation" add column "email_domain" varchar(255) null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "organisation" drop column "email_domain";');
  }

}
