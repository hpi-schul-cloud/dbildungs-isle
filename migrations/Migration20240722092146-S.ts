import { Migration } from '@mikro-orm/migrations';

export class Migration20240722092146 extends Migration {
    async up(): Promise<void> {
        this.addSql('create index "organisation_administriert_von_index" on "organisation" ("administriert_von");');
        this.addSql('create index "organisation_typ_index" on "organisation" ("typ");');

        this.addSql(
            'create unique index "person_keycloak_user_id_unique" on "person" ("keycloak_user_id") nulls not distinct;;',
        );
        this.addSql(
            'create unique index "person_personalnummer_unique" on "person" ("personalnummer") nulls distinct;;',
        );

        this.addSql('create index "personenkontext_person_id_index" on "personenkontext" ("person_id");');
    }

    override async down(): Promise<void> {
        this.addSql('drop index "organisation_administriert_von_index";');
        this.addSql('drop index "organisation_typ_index";');

        this.addSql('drop index "person_keycloak_user_id_unique";');
        this.addSql('drop index "person_personalnummer_unique";');

        this.addSql('drop index "personenkontext_person_id_index";');
    }
}
