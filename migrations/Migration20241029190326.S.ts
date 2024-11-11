import { Migration } from '@mikro-orm/migrations';

export class Migration20241029190326 extends Migration {
    async up(): Promise<void> {
        this.addSql('alter table "user_lock" add column "locked_occasion" varchar(255) null;');
    }

    override async down(): Promise<void> {
        this.addSql('alter table "user_lock" drop column "locked_occasion";');
    }
}
