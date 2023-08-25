/* eslint-disable max-classes-per-file */
import { FilterQuery, Query } from '@mikro-orm/core/typings';
import { PersonEntity } from '../persistence/person.entity.js';

export type Specification<T> = {
    get query(): FilterQuery<T>;
    isSatisfiedBy(candidate: T): boolean;
};

export abstract class SpecificationBase<T> implements Specification<T> {
    public abstract get query(): FilterQuery<T>;

    public abstract isSatisfiedBy(candidate: T): boolean;

    public and(spec: Specification<T>): SpecificationBase<T> {
        throw new Error();
    }
}

class AndSpecification<T> implements Specification<T> {
    public constructor(private readonly specifications: Specification<T> | Specification<T>[]) {}

    public get query(): FilterQuery<T> {
        const condition: FilterQuery<T>[] = Array.isArray(this.specifications)
            ? this.specifications.map((specification: Specification<T>) => specification.query)
            : [this.specifications.query];

        return {
            $and: condition,
        } as FilterQuery<T>;
    }

    public isSatisfiedBy(candidate: T): boolean {
        return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
    }
}

export class UserVisibilitySpecification extends SpecificationBase<PersonEntity> {
    public constructor(private readonly visibility: boolean) {
        super();
    }

    public override get query(): FilterQuery<PersonEntity> {
        return { isInformationBlocked: this.visibility };
    }

    public override isSatisfiedBy(candidate: PersonEntity): boolean {
        return candidate.isInformationBlocked === this.visibility;
    }
}

export class UserFirstNameSpecification extends SpecificationBase<PersonEntity> {
    public constructor(private readonly firstName: string) {
        super();
    }

    public override get query(): FilterQuery<PersonEntity> {
        return { firstName: this.firstName };
    }

    public override isSatisfiedBy(candidate: PersonEntity): boolean {
        return candidate.firstName === this.firstName;
    }
}
