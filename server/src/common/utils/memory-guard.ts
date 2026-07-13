/**
 * 内存回退守卫：生产环境禁用内存回退模式
 *
 * 规范要求：所有业务数据必须持久化到 Supabase，禁止内存 Map。
 * 本工具用于在内存回退分支开头守卫，生产环境直接抛异常而非返回假数据。
 */
import { ServiceUnavailableException } from '@nestjs/common';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 守卫：生产环境禁用内存回退。
 * 在 service 的内存回退分支开头调用，生产环境抛 503 异常。
 *
 * @param moduleName 模块名（用于日志标识）
 * @throws {ServiceUnavailableException} 生产环境抛出
 */
export function assertMemoryFallbackAllowed(moduleName: string): void {
  if (isProduction) {
    throw new ServiceUnavailableException(
      `${moduleName}: 生产环境要求 Supabase 可用，内存回退模式已禁用`,
    );
  }
}

/**
 * 判断当前是否为开发环境（允许内存回退）
 */
export function isDevFallbackAllowed(): boolean {
  return !isProduction;
}
