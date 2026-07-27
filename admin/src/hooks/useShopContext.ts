import { useModel } from '@umijs/max';

/**
 * 读取全局店铺上下文（UMI model: shopContext）
 */
export function useShopContext() {
  return useModel('shopContext');
}

export default useShopContext;
