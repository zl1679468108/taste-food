import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModel } from '@umijs/max';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getShops, type Shop } from '@/services/shop';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';
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
 *
 * 店铺列表与 useShops 共用 queryKeys.shops.list()，避免顶栏 + 页面各打一次 /api/shops。
 */
export default function useShopContextModel() {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const boundShopId = currentUser?.shopId || undefined;
  const queryClient = useQueryClient();

  const [shopId, setShopIdState] = useState<string>('');

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

  const shopsQuery = useQuery({
    queryKey: queryKeys.shops.list(),
    queryFn: getShops,
    enabled: !!currentUser,
    staleTime: STALE_TIMES.STATIC,
  });

  const shops = shopsQuery.data ?? [];
  // 仅首屏/无缓存时显示 loading，避免 window focus 刷新时顶栏闪烁
  const loading = shopsQuery.isLoading;
  const loaded = !currentUser || shopsQuery.isFetched || shopsQuery.isError;

  useEffect(() => {
    if (!currentUser) {
      setShopIdState('');
      return;
    }

    if (!shops.length) {
      if (shopsQuery.isError) {
        const fallback = boundShopId || DEFAULT_SHOP_ID;
        setShopIdState((prev) => prev || fallback);
        writeStoredShopId(fallback);
      }
      return;
    }

    setShopIdState((prev) => {
      if (prev && shops.some((s) => s.id === prev)) {
        return prev;
      }
      const next = resolveInitialShopId(shops);
      if (next) writeStoredShopId(next);
      return next;
    });
  }, [boundShopId, currentUser, resolveInitialShopId, shops, shopsQuery.isError]);

  const loadShops = useCallback(async () => {
    if (!currentUser) return;
    await queryClient.fetchQuery({
      queryKey: queryKeys.shops.list(),
      queryFn: getShops,
      staleTime: STALE_TIMES.STATIC,
    });
  }, [currentUser, queryClient]);

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
