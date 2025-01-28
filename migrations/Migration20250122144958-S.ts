import { Migration } from '@mikro-orm/migrations';

export class Migration20250122144958 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter type "rollen_system_recht_enum" add value if not exists \'BULK_VERWALTEN\';');
  }

}
