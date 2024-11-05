import { Migration } from '@mikro-orm/migrations';

export class Migration20240821132810 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            "update service_provider SET url = 'https://sh-staging.itslintegrations.com/' WHERE name = 'itslearning';",
        );
    }

    override async down(): Promise<void> {}
}
