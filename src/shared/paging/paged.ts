export interface Paged<T> {
    offset: number;
    limit: number;
    total: number; // Total number of items before applying pagination
    pageTotal?: number; // Number of items returned in the current page (after pagination)
    items: T[];
}
