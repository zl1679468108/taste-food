export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 0, data, message };
}

export function fail(code: number, message: string): ApiResponse<null> {
  return { code, data: null, message };
}
