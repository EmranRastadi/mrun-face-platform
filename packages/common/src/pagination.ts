export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
