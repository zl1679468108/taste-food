interface AdminFlags {
  canAdmin?: boolean;
  canOps?: boolean;
  canPlatformAdmin?: boolean;
  canPlatform?: boolean;
  canMerchant?: boolean;
}

interface AccessInitialState {
  currentUser?: { role?: string; shopId?: string };
  admin?: AdminFlags;
}

/**
 * 统一权限判定：
 * - canOps/canAdmin：运营侧（平台管理员 admin 或商家 merchant）可进运营菜单
 * - canPlatformAdmin：仅平台管理员（admin 且无 shopId），可跨店治理与审计
 * - canMerchant：商家（merchant 或绑定单店的 admin）
 */
export default function access(initialState: AccessInitialState | undefined) {
  const { admin, currentUser } = initialState || {};
  const role = currentUser?.role;

  const canOps =
    admin?.canOps ?? admin?.canAdmin ?? (role === 'admin' || role === 'merchant');

  const canPlatformAdmin =
    admin?.canPlatformAdmin ??
    admin?.canPlatform ??
    (role === 'admin' && !currentUser?.shopId);

  const canMerchant =
    admin?.canMerchant ??
    (role === 'merchant' || (role === 'admin' && !!currentUser?.shopId));

  return {
    canAdmin: !!canOps,
    canOps: !!canOps,
    canPlatformAdmin: !!canPlatformAdmin,
    canPlatform: !!canPlatformAdmin,
    canMerchant: !!canMerchant,
  };
}
