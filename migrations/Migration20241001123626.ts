import { Migration } from '@mikro-orm/migrations';

export class Migration20241001123626 extends Migration {
    public up(): void {
        this.addSql('alter table "personenkontext" drop column "rolle";');
    }

    public override down(): void {
        this.addSql(
            "alter table \"personenkontext\" add column \"rolle\" text check (\"rolle\" in ('LERN', 'LEHR', 'EXTERN', 'ORGADMIN', 'LEIT', 'SYSADMIN')) not null;",
        );
    }
}
