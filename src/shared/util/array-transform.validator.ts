import { Transform } from 'class-transformer';

type MaybeArray<T> = T | T[];

export function TransformToArray<T>(): PropertyDecorator {
    return Transform(({ value }: { value: MaybeArray<T> }) => (Array.isArray(value) ? value : [value]));
}
