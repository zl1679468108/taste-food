import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModel } from '@umijs/max';
import { getShops, type Shop } from '@/services/shop';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

export const ADMIN_SHOP_STORAGE_KEY = 'tf_admin_shop_id';

function readStoredShopId(): string | null {
  try {
    return localStorage.getItem(ADMIN_SHOP_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredShopId(shopId: string) {
  try {
    localStorage.setItem(ADMIN_SHOP_STORAGE_KEY, shopId);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * 全局店铺上下文（UMI model）
 *
 * 务实策略：业务页始终绑定具体店铺；平台管理员可切换任意店。
 * 商家账号若绑定单一 shopId 且无法跨店，则锁定选择器。
 */
export default function useShopContextModel() {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const boundShopId = currentUser?.shopId || undefined;

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopIdState] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /**
   * 平台管理员（无 boundShopId）可切换任意店；
   * 商家（绑定 shopId）锁定本店。
   */
  const canSwitchShops = useMemo(() => {
    const locked = (currentUser as { lockedShop?: boolean } | undefined)?.lockedShop;
    if (locked) return false;
    // JWT/用户信息带 shopId → 商家单店；无 shopId → 平台管理员跨店
    return !boundShopId;
  }, [currentUser, boundShopId]);

  const resolveInitialShopId = useCallback(
    (list: Shop[]) => {
      if (!canSwitchShops && boundShopId) {
        return boundShopId;
      }

      const stored = readStoredShopId();
      if (stored && list.some((s) => s.id === stored)) {
        return stored;
      }
      if (boundShopId && list.some((s) => s.id === boundShopId)) {
        return boundShopId;
      }
      if (list.some((s) => s.id === DEFAULT_SHOP_ID)) {
        return DEFAULT_SHOP_ID;
      }
      return list[0]?.id || boundShopId || DEFAULT_SHOP_ID;
    },
    [boundShopId, canSwitchShops],
  );

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await getShops()) || [];
      setShops(list);
      setShopIdState((prev) => {
        if (prev && list.some((s) => s.id === prev)) {
          return prev;
        }
        const next = resolveInitialShopId(list);
        if (next) writeStoredShopId(next);
        return next;
      });
    } catch (error) {
      console.error('加载店铺列表失败:', error);
      // 回退：至少保证有一个可用 shopId
      setShopIdState((prev) => {
        if (prev) return prev;
        const fallback = boundShopId || DEFAULT_SHOP_ID;
        writeStoredShopId(fallback);
        return fallback;
      });
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [boundShopId, resolveInitialShopId]);

  useEffect(() => {
    // 登录后才拉店铺；未登录跳过
    if (!currentUser) {
      setShops([]);
      setShopIdState('');
      setLoaded(false);
      return;
    }
    void loadShops();
  }, [currentUser?.id, loadShops]);

  const setShopId = useCallback(
    (next: string) => {
      if (!next) return;
      if (!canSwitchShops && boundShopId && next !== boundShopId) {
        return;
      }
      setShopIdState(next);
      writeStoredShopId(next);
    },
    [boundShopId, canSwitchShops],
  );

  const currentShop = useMemo(
    () => shops.find((s) => s.id === shopId) || null,
    [shops, shopId],
  );

  return {
    shopId,
    shops,
    currentShop,
    loading,
    loaded,
    ready: loaded && !!shopId,
    canSwitchShops,
    boundShopId,
    setShopId,
    loadShops,
  };
}
