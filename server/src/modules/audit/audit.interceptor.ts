import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function summarize(method: string, path: string, body: unknown): string {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const status = b.status != null ? ` status=${b.status}` : '';
  const tableNo = b.tableNo != null ? ` tableNo=${b.tableNo}` : '';
  const name = b.name != null ? ` name=${b.name}` : '';
  const reply = b.reply != null ? ' reply' : '';
  return `${method} ${path}${status}${tableNo}${name}${reply}`.slice(0, 500);
}

function parseResource(path: string): { resource?: string; resourceId?: string } {
  // /api/orders/xxx/status -> resource=orders, id=xxx
  const clean = path.split('?')[0].replace(/^\/api\/?/, '/');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return {};
  const resource = parts[0];
  let resourceId: string | undefined;
  if (parts[1] && !['stats', 'export', 'seed', 'manage'].includes(parts[1])) {
    // uuid-ish or id segment
    resourceId = parts[1];
  }
  return { resource, resourceId };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Record<string, any>>();
    const method = String(req.method || '').toUpperCase();
    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const user = req.user as
      | { userId?: string; role?: string; shopId?: string }
      | undefined;
    if (!user?.userId) {
      return next.handle();
    }
    // 仅记录商家/管理员写操作
    if (String(user.role || '').toLowerCase() !== UserRole.ADMIN) {
      return next.handle();
    }

    const path = String(req.originalUrl || req.url || '');
    if (path.includes('/audit-logs') || path.includes('/auth/')) {
      return next.handle();
    }

    const startedPath = path;
    const body = req.body;
    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '';

    return next.handle().pipe(
      tap({
        next: () => {
          const { resource, resourceId } = parseResource(startedPath);
          void this.auditService.record({
            shopId: user.shopId || DEFAULT_SHOP_ID,
            userId: user.userId!,
            role: String(user.role || 'admin'),
            method,
            path: startedPath,
            action: `${method} ${resource || 'unknown'}`,
            resource,
            resourceId,
            summary: summarize(method, startedPath, body),
            statusCode: 200,
            ip: String(ip || ''),
          });
        },
        // 失败请求不记成功审计；如需失败日志可另开
        error: () => undefined,
      }),
    );
  }
}
