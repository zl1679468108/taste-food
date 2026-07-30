import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { buildAuditAction, buildAuditSummary } from './audit-labels';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const NON_ID_SEGMENTS = new Set([
  'stats',
  'export',
  'seed',
  'manage',
  'images',
  'popular',
  'business-hours',
  'tables',
  'status',
  'cancel',
  'reorder',
  'grab',
  'deliver',
  'pay',
  'payment',
  'reviews',
  'reply',
  'delivery-track',
  'rider',
  'location',
  'default',
  'set-default',
  'toggle',
  'check',
]);

function parseResource(path: string): { resource?: string; resourceId?: string } {
  // /api/orders/xxx/status -> resource=orders, id=xxx
  const clean = path.split('?')[0].replace(/^\/api\/?/, '/');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return {};

  // shops/:shopId/tables/:tableId → resource=tables
  const tablesIdx = parts.indexOf('tables');
  if (parts[0] === 'shops' && tablesIdx >= 0) {
    const maybeTableId = parts[tablesIdx + 1];
    return {
      resource: 'tables',
      resourceId:
        maybeTableId && !NON_ID_SEGMENTS.has(maybeTableId)
          ? maybeTableId
          : undefined,
    };
  }

  // orders/:orderId/reviews → resource=reviews
  if (parts[0] === 'orders' && parts.includes('reviews')) {
    return {
      resource: 'reviews',
      resourceId:
        parts[1] && !NON_ID_SEGMENTS.has(parts[1]) ? parts[1] : undefined,
    };
  }

  const resource = parts[0];
  let resourceId: string | undefined;
  if (parts[1] && !NON_ID_SEGMENTS.has(parts[1])) {
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
    // 记录平台管理员与商家写操作
    const role = String(user.role || '').toLowerCase();
    if (role !== UserRole.ADMIN && role !== UserRole.MERCHANT) {
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
            action: buildAuditAction(method, startedPath, resource),
            resource,
            resourceId,
            summary: buildAuditSummary(method, startedPath, body, resource),
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
