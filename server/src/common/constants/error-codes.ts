/**
 * 业务错误码常量。
 *
 * 约定：
 * - 成功：code = 0
 * - 失败：code = 业务错误码（非 0 整数，与 HTTP 状态码分离）
 *
 * HTTP 状态码仍按 RESTful 规范返回（200/201/400/401/403/404/500），
 * 业务错误码用于前端稳定的错误识别和国际化文案映射。
 */
export enum BizErrorCode {
  SUCCESS = 0,
  // 通用错误（1xxx）
  UNKNOWN_ERROR = 1000,
  VALIDATION_ERROR = 1001,
  RESOURCE_NOT_FOUND = 1002,
  PERMISSION_DENIED = 1003,
  UNAUTHORIZED = 1004,
  // 业务错误（2xxx）
  ORDER_STATUS_TRANSITION_INVALID = 2001,
  ORDER_CANNOT_CANCEL = 2002,
  ORDER_ALREADY_PAID = 2003,
  ORDER_NOT_PAID = 2004,
  PAYMENT_FAILED = 2005,
  REFUND_FAILED = 2006,
  INSUFFICIENT_STOCK = 2007,
  PRICE_MISMATCH = 2008,
  // 系统错误（5xxx）
  DATABASE_ERROR = 5000,
  EXTERNAL_SERVICE_ERROR = 5001,
  SERVICE_UNAVAILABLE = 5002,
}

/**
 * 错误码对应的默认 HTTP 状态码
 */
export const BIZ_ERROR_HTTP_STATUS: Record<BizErrorCode, number> = {
  [BizErrorCode.SUCCESS]: 200,
  [BizErrorCode.UNKNOWN_ERROR]: 500,
  [BizErrorCode.VALIDATION_ERROR]: 400,
  [BizErrorCode.RESOURCE_NOT_FOUND]: 404,
  [BizErrorCode.PERMISSION_DENIED]: 403,
  [BizErrorCode.UNAUTHORIZED]: 401,
  [BizErrorCode.ORDER_STATUS_TRANSITION_INVALID]: 400,
  [BizErrorCode.ORDER_CANNOT_CANCEL]: 400,
  [BizErrorCode.ORDER_ALREADY_PAID]: 400,
  [BizErrorCode.ORDER_NOT_PAID]: 400,
  [BizErrorCode.PAYMENT_FAILED]: 400,
  [BizErrorCode.REFUND_FAILED]: 500,
  [BizErrorCode.INSUFFICIENT_STOCK]: 400,
  [BizErrorCode.PRICE_MISMATCH]: 400,
  [BizErrorCode.DATABASE_ERROR]: 500,
  [BizErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [BizErrorCode.SERVICE_UNAVAILABLE]: 503,
};
