/**
 * 唯一权限计算源（T300.1）
 *
 * 把散落在 app.tsx / access.ts / Login / RoleSwitcher 四处的权限推导收敛到这里，
 * 消除「同一个用户在不同入口算出不同 canMerchant」的闪现 bug。
 *
 * 角色模型（沿用 PRD §3.18，不新增枚举）：
 * - 平台管理员：role = 'admin' 且 shopId 为空  → 可跨店治理、审计
 * - 商家：     role = 'merchant'，或 role = 'admin' 且绑定了 shopId
 * - 运营侧（canAdmin / canOps）：平台管理员或商家都能进业务菜单
 */
export interface AccessFlags {
  canAdmin: boolean;
  canOps: boolean;
  canPlatformAdmin: boolean;
  canPlatform: boolean;
  canMerchant: boolean;
}

export type AdminUserLike = {
  role?: string | null;
  shopId?: string | null;
} | null | undefined;

export function computeAccess(user?: AdminUserLike): AccessFlags {
  const role = user?.role;
  const shopId = user?.shopId || undefined;

  const isPlatformAdmin = role === 'admin' && !shopId;
  const isMerchant = role === 'merchant' || (role === 'admin' && !!shopId);
  const isOps = isPlatformAdmin || isMerchant;

  return {
    canAdmin: isOps,
    canOps: isOps,
    canPlatformAdmin: isPlatformAdmin,
    canPlatform: isPlatformAdmin,
    canMerchant: isMerchant,
  };
}

export const EMPTY_ACCESS: AccessFlags = {
  canAdmin: false,
  canOps: false,
  canPlatformAdmin: false,
  canPlatform: false,
  canMerchant: false,
};
