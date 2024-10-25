import { Migration } from '@mikro-orm/migrations';

export class Migration20240816120248 extends Migration {
    public up(): void {
        this.addSql('alter table "service_provider" add column "requires2fa" boolean default false;');
    }

    public override down(): void {
        this.addSql('alter table "service_provider" drop column "requires2fa";');
    }
}
