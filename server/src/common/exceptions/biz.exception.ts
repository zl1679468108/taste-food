import { HttpException, HttpStatus } from '@nestjs/common';
import { BizErrorCode, BIZ_ERROR_HTTP_STATUS } from '../constants/error-codes';

/**
 * 业务异常：携带稳定的业务错误码（与 HTTP 状态码分离）。
 * HttpExceptionFilter 会优先识别此异常并返回 code 字段。
 */
export class BizException extends HttpException {
  readonly bizCode: BizErrorCode;

  constructor(bizCode: BizErrorCode, message: string, httpStatus?: HttpStatus) {
    const status = httpStatus ?? BIZ_ERROR_HTTP_STATUS[bizCode] ?? HttpStatus.BAD_REQUEST;
    super({ bizCode, message }, status);
    this.bizCode = bizCode;
  }
}
