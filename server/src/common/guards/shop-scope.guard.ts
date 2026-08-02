import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SHOP_SCOPE_KEY, ShopScope } from '../decorators/shop-scope.decorator';
import { isPlatformAdmin, isShopOperator, ScopeUserLike } from '../utils/admin-shop-scope';

/**
 * 店铺作用域守卫（T300.6，deny-by-default）。
 *
 * 与全局 AuthGuard/RolesGuard 串联执行：请求到达此处时 request.user 已由
 * AuthGuard 挂载（CurrentUserPayload: { userId, openid, role, shopId? }）。
 *
 * 规则：
 * - 未标记 @PlatformOnly/@MerchantOnly 的接口：放行（向后兼容尚未迁移的接口）
 * - @PlatformOnly：仅平台管理员（role=admin 且 shopId 空）可访问
 * - @MerchantOnly：仅商家（role=merchant 或 admin+shopId）可访问
 *
 * 与 T300.5 的后端 /api/platform、/api/merchant 前缀拆分协同，形成双入口隔离骨架。
 */
@Injectable()
export class ShopScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scope = this.reflector.getAllAndOverride<ShopScope>(SHOP_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 未声明作用域的接口不限制（沿用既有店铺隔离逻辑）
    if (!scope) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as ScopeUserLike | undefined;

    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    if (scope === 'platform' && !isPlatformAdmin(user)) {
      throw new ForbiddenException('仅平台管理员可访问');
    }
    if (scope === 'merchant' && !isShopOperator(user)) {
      throw new ForbiddenException('仅商家可访问');
    }

    return true;
  }
}
