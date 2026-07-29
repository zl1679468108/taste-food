/**
 * 腾讯位置服务（WebService API）
 * 文档: https://lbs.qq.com/service/webService/webServiceGuide/webServiceGcoder
 * 坐标体系: GCJ-02（与微信小程序 map / chooseLocation 一致）
 */
import { Logger } from '@nestjs/common';

const logger = new Logger('TencentMap');

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult extends GeoPoint {
  title?: string;
  address?: string;
  province?: string;
  city?: string;
  district?: string;
}

type CacheEntry = { value: GeocodeResult | null; expiresAt: number };

const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getMapKey(): string {
  return (process.env.TENCENT_MAP_KEY || process.env.QQ_MAP_KEY || '').trim();
}

export function hasTencentMapKey(): boolean {
  return !!getMapKey();
}

export function isValidGeoPoint(point?: Partial<GeoPoint> | null): point is GeoPoint {
  if (!point) return false;
  const { latitude, longitude } = point;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  // 0,0 视为无效占位
  if (Math.abs(latitude) < 1e-6 && Math.abs(longitude) < 1e-6) return false;
  return true;
}

export function normalizeGeoPoint(
  latitude?: number | string | null,
  longitude?: number | string | null,
): GeoPoint | undefined {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return undefined;
  }
  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);
  const point = { latitude: lat, longitude: lng };
  return isValidGeoPoint(point) ? point : undefined;
}

function cacheKey(address: string, region?: string): string {
  return `${(region || '').trim()}::${address.trim()}`;
}

/**
 * 地址解析为 GCJ-02 坐标。
 * 未配置 KEY 或解析失败时返回 null（调用方自行降级）。
 */
export async function geocodeAddress(
  address: string,
  options?: { region?: string },
): Promise<GeocodeResult | null> {
  const text = (address || '').trim();
  if (!text) return null;

  const key = getMapKey();
  if (!key) {
    logger.debug('TENCENT_MAP_KEY 未配置，跳过地理编码');
    return null;
  }

  const ck = cacheKey(text, options?.region);
  const cached = geocodeCache.get(ck);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const params = new URLSearchParams({
      key,
      address: text,
      output: 'json',
    });
    if (options?.region?.trim()) {
      params.set('region', options.region.trim());
    }

    const url = `https://apis.map.qq.com/ws/geocoder/v1/?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(`腾讯地图 geocode HTTP ${res.status}`);
      geocodeCache.set(ck, { value: null, expiresAt: Date.now() + 5 * 60 * 1000 });
      return null;
    }
    const body: any = await res.json();
    if (body?.status !== 0 || !body?.result?.location) {
      logger.warn(
        `腾讯地图 geocode 失败: status=${body?.status}, message=${body?.message || ''}, address=${text}`,
      );
      geocodeCache.set(ck, { value: null, expiresAt: Date.now() + 10 * 60 * 1000 });
      return null;
    }

    const loc = body.result.location;
    const point = normalizeGeoPoint(loc.lat, loc.lng);
    if (!point) {
      geocodeCache.set(ck, { value: null, expiresAt: Date.now() + 10 * 60 * 1000 });
      return null;
    }

    const result: GeocodeResult = {
      ...point,
      title: body.result.title,
      address: body.result.address || text,
      province: body.result.address_components?.province,
      city: body.result.address_components?.city,
      district: body.result.address_components?.district,
    };
    geocodeCache.set(ck, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (e) {
    logger.warn(`腾讯地图 geocode 异常: ${e instanceof Error ? e.message : e}`);
    geocodeCache.set(ck, { value: null, expiresAt: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}

/** 若已有合法坐标则直接返回；否则尝试地理编码 */
export async function resolveGeoPoint(params: {
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  region?: string;
}): Promise<GeoPoint | undefined> {
  const existing = normalizeGeoPoint(params.latitude, params.longitude);
  if (existing) return existing;
  if (!params.address?.trim()) return undefined;
  const coded = await geocodeAddress(params.address, { region: params.region });
  return coded || undefined;
}
