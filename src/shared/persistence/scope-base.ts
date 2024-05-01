import { AnyEntity, EntityName, QBFilterQuery, QBQueryOrderMap } from '@mikro-orm/core';
import { EntityManager, QueryBuilder } from '@mikro-orm/postgresql';
import { ScopeOrder, ScopeOperator } from './scope.enums.js';

export abstract class ScopeBase<T extends AnyEntity> {
    private readonly queryFilters: QBFilterQuery<T>[] = [];

    private readonly queryOrderMaps: QBQueryOrderMap<T>[] = [];

    private scopeWhereOperator: ScopeOperator = ScopeOperator.OR;

    private offset: Option<number>;

    private limit: Option<number>;

    protected abstract get entityName(): EntityName<T>;

    public setScopeWhereOperator(operator: ScopeOperator): this {
        this.scopeWhereOperator = operator;
        return this;
    }

    public async executeQuery(em: EntityManager): Promise<Counted<T>> {
        const qb: QueryBuilder<T> = em.createQueryBuilder(this.entityName);
        const combinedFilters: {
            [x: string]: QBFilterQuery<T>[];
        } = { [this.scopeWhereOperator]: this.queryFilters };
        const result: Counted<T> = await qb
            .select('*')
            .where(combinedFilters)
            .orderBy(this.queryOrderMaps)
            .offset(this.offset ?? undefined)
            .limit(this.limit ?? undefined)
            .getResultAndCount();

        return result;
    }

    public sortBy(prop: keyof T, order: ScopeOrder): this {
        const queryOrderMap: QBQueryOrderMap<T> = { [prop]: order };

        this.queryOrderMaps.push(queryOrderMap);

        return this;
    }

    public paged(offset: Option<number>, limit: Option<number>): this {
        this.offset = offset;
        this.limit = limit;

        return this;
    }

    protected findByInternal(props: Findable<T>, operator: ScopeOperator): this {
        const query: QBFilterQuery<T> = {
            [operator]: Object.keys(props)
                .filter((key: string) => props[key] !== undefined)
                .map((key: string) => {
                    return {
                        [key]: props[key],
                    };
                }),
        };

        this.queryFilters.push(query);

        return this;
    }

    public findBySubstring(
        fields: Array<keyof T>,
        substring: string,
        operator: ScopeOperator = ScopeOperator.OR,
    ): this {
        const likeConditions: QBFilterQuery<T>[] = fields.map((field: keyof T): QBFilterQuery<T> => {
            return { [field]: { $ilike: `%${substring}%` } };
        });
        const query: QBFilterQuery<T> = { [operator]: likeConditions };

        this.queryFilters.push(query);

        return this;
    }
}
