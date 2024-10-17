import { Migration } from '@mikro-orm/migrations';

export class Migration20240920111633 extends Migration {

    async up(): Promise<void> {
        this.addSql("UPDATE service_provider SET url = 'http://ox.dev.spsh.dbildungsplattform.de/appsuite/#!!&app=io.ox/mail' WHERE name = 'E-Mail';");
        this.addSql("UPDATE service_provider SET url = 'http://ox.dev.spsh.dbildungsplattform.de/appsuite/#!!&app=io.ox/contacts' WHERE name = 'Adressbuch';");
        this.addSql("UPDATE service_provider SET url = 'http://ox.dev.spsh.dbildungsplattform.de/appsuite/#!!&app=io.ox/calendar' WHERE name = 'Kalender';");
    }

    override async down(): Promise<void> {
    }

}
