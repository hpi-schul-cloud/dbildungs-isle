import { Migration } from '@mikro-orm/migrations';

export class Migration20241008115945 extends Migration {
    public async up(): Promise<void> {
        this.addSql(`ALTER TYPE "rollen_system_recht_enum" ADD VALUE IF NOT EXISTS 'PERSON_SYNCHRONISIEREN';`);
    }

    // No down-migration, because it would be unnecessarily complicated
    // Would need to be:
    // - Rename old enum type
    // - create new enum type
    // - Change all databases depending on the type
    // - Delete old enum type
    // public async down(): Promise<void> {}
}
