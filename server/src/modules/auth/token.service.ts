import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/** Access 默认 2 小时；可用 ACCESS_TOKEN_TTL_MS 覆盖 */
const ACCESS_TTL_MS =
  Number(process.env.ACCESS_TOKEN_TTL_MS) || 2 * 60 * 60 * 1000;
/** Refresh 默认 14 天；可用 REFRESH_TOKEN_TTL_MS 覆盖 */
const REFRESH_TTL_MS =
  Number(process.env.REFRESH_TOKEN_TTL_MS) || 14 * 24 * 60 * 60 * 1000;

/**
 * 不透明双 Token 工具（对齐 family-bookkeeping）：
 * - Access：短时效，请求 Bearer 携带
 * - Refresh：长时效，仅用于 /auth/refresh 换发 access
 * - 均存 SHA-256 hash，不落明文
 */
@Injectable()
export class TokenService {
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getAccessExpiresAt(): string {
    return new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  }

  getRefreshExpiresAt(): string {
    return new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  }

  get accessTtlMs(): number {
    return ACCESS_TTL_MS;
  }

  get refreshTtlMs(): number {
    return REFRESH_TTL_MS;
  }
}
