/* eslint-disable max-classes-per-file */

/* eslint-disable @typescript-eslint/no-use-before-define */

export interface Specification<T> {
    isSatisfiedBy(t: T): Promise<boolean>;

    and(other: Specification<T>): Specification<T>;

    or(other: Specification<T>): Specification<T>;

    not(): Specification<T>;

    andNot(other: Specification<T>): Specification<T>;

    orNot(other: Specification<T>): Specification<T>;
}

export abstract class CompositeSpecification<T> implements Specification<T> {
    public abstract isSatisfiedBy(t: T): Promise<boolean>;

    public and(other: Specification<T>): Specification<T> {
        return new AndSpecification(this, other);
    }

    public or(other: Specification<T>): Specification<T> {
        return new OrSpecification(this, other);
    }

    public not(): Specification<T> {
        return new NotSpecification(this);
    }

    public andNot(other: Specification<T>): Specification<T> {
        return new AndNotSpecification(this, other);
    }

    public orNot(other: Specification<T>): Specification<T> {
        return new OrNotSpecification(this, other);
    }
}

export class AndNotSpecification<T> extends CompositeSpecification<T> {
    public constructor(
        private readonly leftCondition: Specification<T>,
        private readonly rightCondition: Specification<T>,
    ) {
        super();
    }

    public async isSatisfiedBy(t: T): Promise<boolean> {
        return (await this.leftCondition.isSatisfiedBy(t)) && !(await this.rightCondition.isSatisfiedBy(t));
    }
}

export class AndSpecification<T> extends CompositeSpecification<T> {
    public constructor(
        private readonly leftCondition: CompositeSpecification<T>,
        private readonly rightCondition: CompositeSpecification<T>,
    ) {
        super();
    }

    public async isSatisfiedBy(t: T): Promise<boolean> {
        return (await this.leftCondition.isSatisfiedBy(t)) && (await this.rightCondition.isSatisfiedBy(t));
    }
}

export class NotSpecification<T> extends CompositeSpecification<T> {
    public constructor(private readonly condition: Specification<T>) {
        super();
    }

    public async isSatisfiedBy(t: T): Promise<boolean> {
        return !(await this.condition.isSatisfiedBy(t));
    }
}

export class OrNotSpecification<T> extends CompositeSpecification<T> {
    public constructor(
        private readonly leftCondition: Specification<T>,
        private readonly rightCondition: Specification<T>,
    ) {
        super();
    }

    public async isSatisfiedBy(t: T): Promise<boolean> {
        return (await this.leftCondition.isSatisfiedBy(t)) || !(await this.rightCondition.isSatisfiedBy(t));
    }
}

export class OrSpecification<T> extends CompositeSpecification<T> {
    public constructor(
        private readonly leftCondition: Specification<T>,
        private readonly rightCondition: Specification<T>,
    ) {
        super();
    }

    public async isSatisfiedBy(t: T): Promise<boolean> {
        return (await this.leftCondition.isSatisfiedBy(t)) || (await this.rightCondition.isSatisfiedBy(t));
    }
}
