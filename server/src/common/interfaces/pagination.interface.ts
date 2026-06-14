export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
