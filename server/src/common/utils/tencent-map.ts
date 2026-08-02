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

export function getMapKey(): string {
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


export interface StaticMapMarker {
  latitude: number;
  longitude: number;
  /** 颜色，如 blue / 0xFF6B35 */
  color?: string;
  /** 单字符或短 label */
  label?: string;
}

/**
 * 拉取腾讯静态地图图片（WebService Key）。
 * 成功返回 image buffer；未配置 key / 失败返回 null。
 */
export async function fetchStaticMapImage(options: {
  markers: StaticMapMarker[];
  path?: Array<{ latitude: number; longitude: number }>;
  size?: string;
  zoom?: number;
  scale?: 1 | 2;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  const key = getMapKey();
  if (!key) return null;

  const markers = (options.markers || []).filter(
    (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude),
  );
  if (markers.length === 0) return null;

  const size = options.size || '640*360';
  const scale = options.scale || 2;
  const params = new URLSearchParams({
    key,
    size,
    scale: String(scale),
    maptype: 'roadmap',
  });
  if (options.zoom) params.set('zoom', String(options.zoom));

  // markers=color:blue|label:店|lat,lng|color:0xFF6B35|label:骑|lat,lng
  const markerParts: string[] = ['size:large'];
  for (const m of markers) {
    markerParts.push(`color:${m.color || 'blue'}`);
    if (m.label) markerParts.push(`label:${m.label}`);
    markerParts.push(`${m.latitude},${m.longitude}`);
  }
  params.set('markers', markerParts.join('|'));

  const pathPts = (options.path || []).filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (pathPts.length >= 2) {
    const pathStr =
      'color:0xFF8F65ff|weight:4|' +
      pathPts.map((p) => `${p.latitude},${p.longitude}`).join('|');
    params.set('path', pathStr);
  }

  // 无 path/多点时由 markers 自动定视野；单点补 center
  if (markers.length === 1 && pathPts.length < 2) {
    params.set('center', `${markers[0].latitude},${markers[0].longitude}`);
    if (!options.zoom) params.set('zoom', '15');
  }

  try {
    const url = `https://apis.map.qq.com/ws/staticmap/v2/?${params.toString()}`;
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) {
      logger.warn(`腾讯静态地图 HTTP ${res.status}`);
      return null;
    }
    // 失败时接口常返回 JSON
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      try {
        const body = JSON.parse(buf.toString('utf8'));
        logger.warn(
          `腾讯静态地图失败: status=${body?.status}, message=${body?.message || ''}`,
        );
      } catch {
        logger.warn('腾讯静态地图返回非图片内容');
      }
      return null;
    }
    return { buffer: buf, contentType: contentType || 'image/png' };
  } catch (e) {
    logger.warn(`腾讯静态地图异常: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}


/**
 * 计算两点球面距离（米）。坐标按 WGS84/GCJ-02 近似（短距离误差可忽略）。
 */
export function haversineDistanceMeters(
  a: GeoPoint,
  b: GeoPoint,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 送达确认有效半径 = 基础半径 + min(定位精度, 缓冲上限)
 */
export function resolveDeliveryConfirmRadiusM(params: {
  baseRadiusM?: number;
  accuracyM?: number;
  minM?: number;
  maxM?: number;
  accuracyBufferMaxM?: number;
}): number {
  const minM = params.minM ?? 200;
  const maxM = params.maxM ?? 1000;
  const accuracyBufferMaxM = params.accuracyBufferMaxM ?? 50;
  const base = Math.min(maxM, Math.max(minM, params.baseRadiusM ?? 500));
  const accuracy = Math.max(0, params.accuracyM ?? 0);
  const buffer = Math.min(accuracy, accuracyBufferMaxM);
  return Math.min(maxM, base + buffer);
}
