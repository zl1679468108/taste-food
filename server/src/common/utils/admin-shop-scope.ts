import { ForbiddenException } from '@nestjs/common';
import { DEFAULT_SHOP_ID } from '../constants/shop';

export interface AdminShopScopeOptions {
  /**
   * 商家账号锁定：强制使用 JWT 绑定的 shopId，禁止跨店。
   * 平台管理员默认 false（允许请求显式 shop_id 切换店铺）。
   */
  lockToBoundShop?: boolean;
}

/**
 * 解析 admin 目标店铺（PC 多店上下文）。
 * - 请求显式带 shop_id/shopId 时优先使用（平台管理员切换店铺）
 * - 否则回退 JWT 绑定店 / DEFAULT_SHOP_ID
 */
export function resolveAdminTargetShopId(
  userShopId?: string | null,
  requestedShopId?: string | null,
  options?: AdminShopScopeOptions,
): string {
  const bound = userShopId || undefined;
  const requested = requestedShopId?.trim() || undefined;

  if (options?.lockToBoundShop && bound) {
    if (requested && requested !== bound) {
      throw new ForbiddenException('无权操作其他店铺');
    }
    return bound;
  }

  return requested || bound || DEFAULT_SHOP_ID;
}

/**
 * 校验 admin 是否可访问目标店铺。
 * 默认允许平台管理员跨店；商家锁定时拒绝。
 */
export function assertAdminShopAccess(
  userShopId: string | undefined,
  targetShopId: string,
  options?: AdminShopScopeOptions,
): void {
  if (options?.lockToBoundShop && userShopId && targetShopId !== userShopId) {
    throw new ForbiddenException('无权操作其他店铺');
  }
}
