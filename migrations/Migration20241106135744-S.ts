import { Migration } from '@mikro-orm/migrations';

export class Migration20241106135744 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'alter table "user_lock" alter column "locked_occasion" type varchar(255) using ("locked_occasion"::varchar(255));',
        );
        this.addSql('alter table "user_lock" alter column "locked_occasion" set not null;');
        this.addSql(
            'alter table "user_lock" add constraint "user_lock_person_id_locked_occasion_unique" unique ("person_id", "locked_occasion");',
        );
    }

    override async down(): Promise<void> {
        this.addSql('alter table "user_lock" drop constraint "user_lock_person_id_locked_occasion_unique";');

        this.addSql(
            'alter table "user_lock" alter column "locked_occasion" type varchar(255) using ("locked_occasion"::varchar(255));',
        );
        this.addSql('alter table "user_lock" alter column "locked_occasion" drop not null;');
    }
}
