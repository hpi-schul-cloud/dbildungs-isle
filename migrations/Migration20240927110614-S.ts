import { Migration } from '@mikro-orm/migrations';

export class Migration20240927110614 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table "user_lock" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "person_id" uuid not null, "locked_by" varchar(255) not null, "locked_until" timestamptz null, constraint "user_lock_pkey" primary key ("id"));',
        );

        this.addSql(
            'alter table "user_lock" add constraint "user_lock_person_id_foreign" foreign key ("person_id") references "person" ("id") on update cascade;',
        );
    }

    override async down(): Promise<void> {
        this.addSql('drop table if exists "user_lock" cascade;');
    }
}
