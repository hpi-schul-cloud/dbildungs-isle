import { Migration } from '@mikro-orm/migrations';

export class Migration20241009090154 extends Migration {

    async up(): Promise<void> {
        this.addSql("UPDATE organisation SET kuerzel = NULL WHERE typ = 'KLASSE';");
        this.addSql("UPDATE organisation SET kennung = NULL WHERE typ = 'KLASSE';");
    }

    override async down(): Promise<void> {
    }

}
