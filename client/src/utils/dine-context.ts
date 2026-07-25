import Taro from '@tarojs/taro';
import { DEFAULT_SHOP_ID } from '../env';

const STORAGE_KEY = 'tf_dine_context';

export interface DineContext {
  shopId: string;
  tableNo: string;
  source: 'qr' | 'manual';
  updatedAt: string;
}

function safeGetStorage(key: string): string {
  try {
    return String(Taro.getStorageSync(key) || '');
  } catch {
    return '';
  }
}

function safeSetStorage(key: string, value: string) {
  try {
    Taro.setStorageSync(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveStorage(key: string) {
  try {
    Taro.removeStorageSync(key);
  } catch {
    // ignore
  }
}

/** 解析小程序码 scene / 普通 query 中的桌号 */
export function parseDineParams(params?: Record<string, string | undefined> | null): Partial<DineContext> | null {
  if (!params) return null;
  let tableNo = (params.tableNo || params.table_no || params.table || '').trim();
  let shopId = (params.shopId || params.shop_id || '').trim();
  const dineInRaw = (params.dineIn || params.dine_in || params.dine || '').trim();

  // 微信小程序码 scene：最多 32 字符，约定 t=A01 或 t=A01&s=shop短码；简化仅 t=桌号
  const sceneRaw = (params.scene || '').trim();
  if (sceneRaw) {
    try {
      const decoded = decodeURIComponent(sceneRaw);
      const pairs = decoded.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (!k) continue;
        if ((k === 't' || k === 'tableNo' || k === 'table') && v) tableNo = decodeURIComponent(v);
        if ((k === 's' || k === 'shopId') && v) shopId = decodeURIComponent(v);
      }
      // 纯桌号 scene
      if (!tableNo && !decoded.includes('=')) {
        tableNo = decoded;
      }
    } catch {
      if (!tableNo) tableNo = sceneRaw;
    }
  }

  if (!tableNo) return null;
  return {
    tableNo,
    shopId: shopId || DEFAULT_SHOP_ID,
    source: 'qr',
  };
}

export function saveDineContext(ctx: { shopId?: string; tableNo: string; source?: 'qr' | 'manual' }): DineContext {
  const next: DineContext = {
    shopId: ctx.shopId || DEFAULT_SHOP_ID,
    tableNo: ctx.tableNo.trim(),
    source: ctx.source || 'manual',
    updatedAt: new Date().toISOString(),
  };
  safeSetStorage(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function loadDineContext(): DineContext | null {
  const raw = safeGetStorage(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DineContext;
    if (!parsed?.tableNo) return null;
    return {
      shopId: parsed.shopId || DEFAULT_SHOP_ID,
      tableNo: String(parsed.tableNo),
      source: parsed.source === 'qr' ? 'qr' : 'manual',
      updatedAt: parsed.updatedAt || '',
    };
  } catch {
    return null;
  }
}

export function clearDineContext() {
  safeRemoveStorage(STORAGE_KEY);
}

export function applyDineParamsFromRouter(
  params?: Record<string, string | undefined> | null,
): DineContext | null {
  const parsed = parseDineParams(params);
  if (!parsed?.tableNo) return loadDineContext();
  return saveDineContext({
    shopId: parsed.shopId,
    tableNo: parsed.tableNo,
    source: 'qr',
  });
}
