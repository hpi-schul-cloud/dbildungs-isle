import { Migration } from '@mikro-orm/migrations';

export class Migration20240909061707 extends Migration {

    public up(): void {
        this.addSql('create type "email_address_status_enum" as enum (\'ENABLED\', \'DISABLED\', \'REQUESTED\');');

        this.addSql('alter table "email_address" add column "status" "email_address_status_enum" null;');

        this.addSql("UPDATE email_address SET status = 'ENABLED' WHERE enabled = true;");
        this.addSql("UPDATE email_address SET status = 'DISABLED' WHERE enabled = false;");

        this.addSql('alter table "email_address" drop column "enabled";');
    }

    public override down(): void {

        this.addSql('alter table "email_address" add column "enabled" boolean not null;');

        this.addSql("UPDATE email_address SET enabled = true WHERE status = 'ENABLED';");
        this.addSql("UPDATE email_address SET enabled = false WHERE status = 'DISABLED';");
        this.addSql("UPDATE email_address SET enabled = false WHERE status = 'REQUESTED';");

        this.addSql('alter table "email_address" drop column "status";');

        this.addSql('drop type "email_address_status_enum";');
    }

}
