import { Migration } from '@mikro-orm/migrations';

export class Migration20241023232123 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter type "rollen_system_recht_enum" add value if not exists \'PERSONEN_ANLEGEN\';');
  }

}
