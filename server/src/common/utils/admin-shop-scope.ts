import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DEFAULT_SHOP_ID } from '../constants/shop';

/** 当前登录用户最小信息（与 AuthGuard 注入的 CurrentUserPayload 对齐） */
export interface ScopeUserLike {
  role?: string | null;
  shopId?: string | null;
}

/**
 * 权威角色判定（T300.6）。
 * - 平台管理员：role = 'admin' 且 shopId 为空（跨店治理）
 * - 商家：role = 'merchant'，或 role = 'admin' 且绑定了 shopId（一店一商家）
 * 沿用 PRD §3.18 角色模型，不新增枚举。
 */
export function isPlatformAdmin(user?: ScopeUserLike | null): boolean {
  return !!user && user.role === 'admin' && !user.shopId;
}

/** 是否为商家（含 admin+shopId 的二义历史账号，已统一迁为 merchant，此处仍兜底识别） */
export function isShopOperator(user?: ScopeUserLike | null): boolean {
  if (!user) return false;
  return user.role === 'merchant' || (user.role === 'admin' && !!user.shopId);
}

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

/* -------------------------------------------------------------------------- */
/* 角色-店铺写时不变量（T301）                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 角色与店铺绑定的唯一合法组合（PRD §3.18 双入口角色模型）：
 *
 * | role     | shop_id | 含义                          |
 * |----------|---------|-------------------------------|
 * | admin    | 空      | 平台管理员（跨店治理）          |
 * | merchant | 非空    | 商家（一店一商家）              |
 * | rider    | 任意    | 骑手（可绑店，也可平台池）      |
 * | customer | 任意    | 顾客（通常为空）                |
 *
 * 历史上存在 `admin + shop_id 非空` 的二义账号（既像平台管理员又像商家），
 * 会让 ShopScopeGuard 的 isPlatformAdmin / isShopOperator 判定互相打架，
 * 造成越权风险。这类存量数据已由 migration v29 归并为 merchant，
 * 本函数负责堵住**写入路径**，防止二义账号再次产生。
 */
export function assertRoleShopInvariant(
  role: string | null | undefined,
  shopId: string | null | undefined,
): void {
  const normalizedShopId = typeof shopId === 'string' ? shopId.trim() : shopId;

  if (role === 'admin' && normalizedShopId) {
    throw new BadRequestException(
      '平台管理员（admin）不可绑定店铺；如需创建店铺管理账号，请使用 merchant 角色',
    );
  }

  if (role === 'merchant' && !normalizedShopId) {
    throw new BadRequestException('商家账号（merchant）必须绑定店铺');
  }
}

/**
 * 将 role 对应的 shop_id 规范化为可安全落库的值。
 *
 * 用于登录/初始化等**不适合直接抛错**的内部路径（抛错会让用户登不进来），
 * 对外的账号管理接口请优先使用 {@link assertRoleShopInvariant} 显式报错。
 *
 * - admin  → 一律置空（杜绝二义账号）
 * - 其他角色 → 原样返回（空串统一为 null）
 */
export function normalizeShopIdForRole(
  role: string | null | undefined,
  shopId: string | null | undefined,
): string | null {
  if (role === 'admin') return null;
  const trimmed = typeof shopId === 'string' ? shopId.trim() : shopId;
  return trimmed ? trimmed : null;
}
