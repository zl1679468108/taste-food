/**
 * 环境相关工具：统一 isProduction / isDevFallbackAllowed 判断
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 是否允许内存回退（开发环境默认允许，生产环境需显式开启 ALLOW_MEMORY_FALLBACK）
 */
export function isDevFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_FALLBACK === 'true';
}
