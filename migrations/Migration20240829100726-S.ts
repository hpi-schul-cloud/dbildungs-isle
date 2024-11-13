import { Migration } from '@mikro-orm/migrations';

export class Migration20240829100726 extends Migration {
    public up(): void {
        this.addSql('alter table "personenkontext" add column "befristung" timestamptz null;');
    }

    public override down(): void {
        this.addSql('alter table "personenkontext" drop column "befristung";');
    }
}
