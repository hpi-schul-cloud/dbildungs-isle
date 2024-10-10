import { Migration } from '@mikro-orm/migrations';

export class Migration20241004081811 extends Migration {
    public up(): void {
        this.addSql('alter table "organisation" add column "email_address" varchar(255) null;');
    }

    public override down(): void {
        this.addSql('alter table "organisation" drop column "email_address";');
    }
}
