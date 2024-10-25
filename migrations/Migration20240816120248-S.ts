import { Migration } from '@mikro-orm/migrations';

export class Migration20240816120248 extends Migration {
    async up(): Promise<void> {
        this.addSql('alter table "rolle" add column "ist_technisch" boolean not null default false;');

        this.addSql("update rolle set ist_technisch = true where name = 'Migration';");
    }

    override async down(): Promise<void> {
        this.addSql('alter table "rolle" drop column "ist_technisch";');
    }
}
