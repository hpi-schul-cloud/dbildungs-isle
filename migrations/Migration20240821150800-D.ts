import { Migration } from '@mikro-orm/migrations';

export class Migration20240816120248 extends Migration {
    public up(): void {
        this.addSql("UPDATE service_provider SET url = 'https://school-sh.qs.schule-sh.de/' WHERE name = 'School-SH';");
    }

    public override down(): void {}
}
