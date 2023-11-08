import { ValidateBy, buildMessage } from 'class-validator';

type Predicate<T = unknown> = (val: unknown) => val is T;

/**
 * class-validator decorator that tries to apply predicates until one matches
 *
 * @example
 * @OneOf(isInt, isString)
 * public intOrString: number | string;
 */
export function OneOf(...predicates: Predicate[]): PropertyDecorator {
    return ValidateBy({
        name: 'one-of-' + predicates.map((p: Predicate) => p.name).join('-'),
        validator: {
            validate: (value: unknown) => predicates.some((p: Predicate) => p(value)),
            defaultMessage: buildMessage(
                (eachPrefix: string) =>
                    eachPrefix + '$property must match one of ' + predicates.map((p: Predicate) => p.name).join(),
            ),
        },
    });
}
