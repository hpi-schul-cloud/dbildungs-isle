import { Migration } from '@mikro-orm/migrations';

export class Migration20241010072717 extends Migration {
    public async up(): Promise<void> {
        this.addSql('alter type "rollen_system_recht_enum" add value if not exists \'CRON_DURCHFUEHREN\';');
        this.addSql("update rolle set ist_technisch = true where name = 'Technical User CRON';");
    }
}
