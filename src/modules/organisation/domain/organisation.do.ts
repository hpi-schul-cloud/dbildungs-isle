import { AutoMap } from '@automapper/classes';
import { DoBase } from '../../../shared/types/index.js';
import { OrganisationsTyp } from './organisation.enum.js';

export class OrganisationDo<WasPersisted extends boolean> implements DoBase<WasPersisted> {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    public constructor() {}

    @AutoMap()
    public createdAt!: Persisted<Date, WasPersisted>;

    @AutoMap()
    public updatedAt!: Persisted<Date, WasPersisted>;

    @AutoMap()
    public id!: Persisted<string, WasPersisted>;

    @AutoMap()
    public kennung?: string;

    @AutoMap()
    public name?: string;

    @AutoMap()
    public namensergaenzung?: string;

    @AutoMap()
    public kuerzel?: string;

    @AutoMap()
    public typ?: OrganisationsTyp;
}
