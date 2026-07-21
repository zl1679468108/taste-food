import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';
import { BizErrorCode } from '../constants/error-codes';
import { BizException } from '../exceptions/biz.exception';

/**
 * 全局异常过滤器。
 * - BizException：使用 bizCode 作为响应 code 字段
 * - 其他 HttpException：根据状态码映射到 BizErrorCode
 * - 未知异常：返回 500 + UNKNOWN_ERROR
 *
 * 响应格式：{ code: BizErrorCode, data: null, message: string }
 * HTTP 状态码与业务 code 分离：HTTP 仍按 RESTful，code 用于前端稳定识别。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let bizCode: BizErrorCode = BizErrorCode.UNKNOWN_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof BizException) {
      status = exception.getStatus();
      bizCode = exception.bizCode;
      message = this.extractMessage(exception);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      bizCode = this.mapHttpStatusToBizCode(status);
      message = this.extractMessage(exception);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const body: ApiResponse<null> = {
      code: bizCode,
      data: null,
      message,
    };

    response.status(status).json(body);
  }

  private extractMessage(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') return exceptionResponse;
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(resp.message)) {
        return (resp.message as string[]).join('; ');
      }
      if (typeof resp.message === 'string') return resp.message;
      if (typeof resp.message === 'undefined' && typeof resp['message'] === 'string') {
        return resp['message'] as string;
      }
    }
    return exception.message;
  }

  private mapHttpStatusToBizCode(status: number): BizErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return BizErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return BizErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return BizErrorCode.PERMISSION_DENIED;
      case HttpStatus.NOT_FOUND:
        return BizErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return BizErrorCode.SERVICE_UNAVAILABLE;
      default:
        return BizErrorCode.UNKNOWN_ERROR;
    }
  }
}
