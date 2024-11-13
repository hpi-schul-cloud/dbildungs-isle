import { Migration } from '@mikro-orm/migrations';

export class Migration20241016115912 extends Migration {

  async up(): Promise<void> {
      this.addSql("UPDATE organisation SET email_domain = 'schule-sh.de' WHERE name = 'Öffentliche Schulen Land Schleswig-Holstein';");
      this.addSql("UPDATE organisation SET email_domain = 'ersatzschule-sh.de' WHERE name = 'Ersatzschulen Land Schleswig-Holstein';");
  }

  override async down(): Promise<void> {
  }

}
