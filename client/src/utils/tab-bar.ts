import Taro from '@tarojs/taro';

/** Tab 页路径常量 */
export const TAB_BAR_PATHS = {
  menu: '/pages/menu/index',
  orderList: '/pages/order-list/index',
  mine: '/pages/mine/index',
  admin: '/pages/admin/index',
  rider: '/pages/rider/index',
} as const;

type SelectedPathListener = (path: string) => void;

const listeners = new Set<SelectedPathListener>();
let selectedPath = '';

/** 归一化页面路径为 /pages/... 形式 */
export function normalizeTabPath(path?: string | null): string {
  if (!path) return '';
  const clean = path.split('?')[0].replace(/^\//, '');
  return clean ? `/${clean}` : '';
}

/** 读取当前栈顶页面路径 */
export function getCurrentTabPath(): string {
  try {
    const pages = Taro.getCurrentPages();
    const current = pages[pages.length - 1] as { route?: string } | undefined;
    return normalizeTabPath(current?.route);
  } catch {
    return '';
  }
}

/** 获取当前 tabBar 选中路径（优先外部同步值） */
export function getTabBarSelectedPath(): string {
  return selectedPath || getCurrentTabPath();
}

/** 同步 tabBar 选中态（点击 / 页面 onShow / 角色跳转） */
export function setTabBarSelectedPath(path: string): void {
  const next = normalizeTabPath(path);
  if (!next || next === selectedPath) return;
  selectedPath = next;
  listeners.forEach((listener) => listener(selectedPath));
}

/** 订阅选中路径变化，返回取消订阅函数 */
export function subscribeTabBarSelectedPath(listener: SelectedPathListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
