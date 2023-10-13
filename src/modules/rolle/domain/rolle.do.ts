import { AutoMap } from '@automapper/classes';
import { Property } from '@mikro-orm/core';
import { DoBase } from '../../../shared/types/index.js';

export class RolleDo<WasPersisted extends boolean> implements DoBase<WasPersisted> {
    /**
     * @deprecated This constructor is for automapper only.
     */
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    public constructor() {}

    @AutoMap()
    public id!: Persisted<string, WasPersisted>;

    @AutoMap()
    public createdAt!: Persisted<Date, WasPersisted>;

    @AutoMap()
    public updatedAt!: Persisted<Date, WasPersisted>;

    @AutoMap()
    @Property()
    public administeredBySchulstrukturknoten!: string;
}
