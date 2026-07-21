import { SetMetadata } from '@nestjs/common';

/**
 * 标记接口为公开访问（无需认证）。
 * 用于全局 AuthGuard 注册后，对登录、健康检查、公开菜单等接口放行。
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
