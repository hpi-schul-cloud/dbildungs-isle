import { Migration } from '@mikro-orm/migrations';

export class Migration20241103022146 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user_lock" drop constraint "user_lock_person_id_foreign";');

    this.addSql('alter table "user_lock" add constraint "user_lock_person_id_foreign" foreign key ("person_id") references "person" ("id") on delete cascade;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "user_lock" drop constraint "user_lock_person_id_foreign";');

    this.addSql('alter table "user_lock" add constraint "user_lock_person_id_foreign" foreign key ("person_id") references "person" ("id") on update cascade;');
  }

}
