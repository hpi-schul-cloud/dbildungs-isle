import { DbSeedStatus } from '../repo/db-seed.entity.js';

export class DbSeed<WasPersisted extends boolean> {
    private constructor(
        public hash: string,
        public executedAt: Persisted<Date, WasPersisted>,
        public status: DbSeedStatus,
        public path: string | undefined,
    ) {}

    public static construct<WasPersisted extends boolean = false>(
        hash: string,
        executedAt: Date,
        status: DbSeedStatus,
        path?: string,
    ): DbSeed<WasPersisted> {
        return new DbSeed(hash, executedAt, status, path);
    }

    public static createNew(hash: string, status: DbSeedStatus, path?: string): DbSeed<false> {
        return new DbSeed(hash, undefined, status, path);
    }

    public setDone(): void {
        this.status = DbSeedStatus.DONE;
    }

    public setFailed(): void {
        this.status = DbSeedStatus.FAILED;
    }
}
