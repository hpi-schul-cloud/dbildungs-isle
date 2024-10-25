import { Migration } from '@mikro-orm/migrations';

export class Migration20241021132722 extends Migration {
    async up(): Promise<void> {
        this.addSql('alter table "person" add column "org_unassignment_date" timestamptz null;');
    }

    override async down(): Promise<void> {
        this.addSql('alter table "person" drop column "org_unassignment_date";');
    }
}
