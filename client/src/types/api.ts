/** 统一 API 响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 分页数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页查询参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
