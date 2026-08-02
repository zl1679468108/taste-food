import { computeAccess, EMPTY_ACCESS, type AccessFlags } from '@/utils/computeAccess';

export type { AccessFlags };

/**
 * UMI access 插件入口（T300.1）。
 * 实际权限计算已收敛到 utils/computeAccess.ts，此处仅从 initialState 桥接。
 */
export default function access(
  initialState: { currentUser?: { role?: string; shopId?: string } } | undefined,
): AccessFlags {
  if (!initialState?.currentUser) return EMPTY_ACCESS;
  return computeAccess(initialState.currentUser);
}
