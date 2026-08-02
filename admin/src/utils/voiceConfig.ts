/**
 * 商家语音播报配置存储与解析（T308 重构）。
 *
 * 配置结构 VoiceAlertConfig = { selection, enabled, volume, repeat }
 * - selection：每状态选中的话术 id（{ [kind]: optionId }）
 * - enabled：总开关（T311）
 * - volume：0~1 播放音量（T311）
 * - repeat：1~3 同一事件重复播报次数（T311）
 *
 * 存储策略（T308）：
 * - 主存储：后端 tf_shops.voice_alert_config（按 shopId 隔离，跨设备/换浏览器不丢失）
 * - 兜底：localStorage（离线/后端不可用时），键 voiceAlertConfig:v2:${shopId}
 * - 同步播放路径（orderAlertSound）走内存缓存 getVoiceAlertConfigSync()，保证无异步阻塞。
 *
 * 若需多端实时同步，后端接口已是唯一数据源；前端首屏 loadVoiceAlertConfig 拉取即可。
 */

import request from '@/utils/request';
import {
  VOICE_OPTIONS,
  PHRASE_POOL,
  type AdminOrderAlertKind,
  type VoiceOption,
} from './alertPhrases';

export type VoiceAlertSelection = Partial<Record<AdminOrderAlertKind, string>>;

export interface VoiceAlertConfig {
  selection: VoiceAlertSelection;
  enabled: boolean;
  volume: number;
  repeat: number;
}

const STORAGE_PREFIX = 'voiceAlertConfig:';
const CONFIG_VERSION = 'v2';

function configKey(shopId: string): string {
  return `${STORAGE_PREFIX}${CONFIG_VERSION}:${shopId}`;
}

/** 读取当前登录用户所属 shopId（与 app.tsx 同源：localStorage.user） */
export function currentShopId(): string {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.shopId) return String(u.shopId);
    }
  } catch {
    /* ignore */
  }
  return 'default';
}

export function defaultSelection(): VoiceAlertSelection {
  const sel: VoiceAlertSelection = {};
  (Object.keys(VOICE_OPTIONS) as AdminOrderAlertKind[]).forEach((k) => {
    const opts = VOICE_OPTIONS[k];
    if (opts && opts.length) sel[k] = opts[0].id;
  });
  return sel;
}

export function defaultVoiceAlertConfig(): VoiceAlertConfig {
  return { selection: defaultSelection(), enabled: true, volume: 1, repeat: 1 };
}

function normalizeConfig(c: any): VoiceAlertConfig {
  const def = defaultVoiceAlertConfig();
  if (!c || typeof c !== 'object') return def;
  return {
    selection: c.selection && typeof c.selection === 'object' ? c.selection : def.selection,
    enabled: typeof c.enabled === 'boolean' ? c.enabled : def.enabled,
    volume: typeof c.volume === 'number' ? Math.min(1, Math.max(0, c.volume)) : def.volume,
    repeat: typeof c.repeat === 'number' ? Math.min(3, Math.max(1, Math.round(c.repeat))) : def.repeat,
  };
}

// ---- 同步缓存（播放路径使用，避免异步阻塞）----
let cache: VoiceAlertConfig = defaultVoiceAlertConfig();

function readLocal(shopId: string): VoiceAlertConfig | null {
  try {
    const raw = localStorage.getItem(configKey(shopId));
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return null;
}

function writeLocal(config: VoiceAlertConfig, shopId: string): void {
  try {
    localStorage.setItem(configKey(shopId), JSON.stringify(config));
  } catch {
    /* 隐私模式写入失败不阻塞 */
  }
}

/** 同步读取当前生效配置（播放路径用） */
export function getVoiceAlertConfigSync(shopId?: string): VoiceAlertConfig {
  const sid = shopId || currentShopId();
  const local = readLocal(sid);
  if (local) return local;
  return cache;
}

/**
 * 从后端拉取配置并写入本地缓存（应用启动/登录后调用一次）。
 * 后端不可用时退回 localStorage / 默认，不阻塞主流程。
 */
export async function loadVoiceAlertConfig(shopId?: string): Promise<VoiceAlertConfig> {
  const sid = shopId || currentShopId();
  const local = readLocal(sid);
  cache = local || cache;
  try {
    const remote = (await request.get(
      `/api/merchant/shops/${sid}/voice-alert-config`,
    )) as VoiceAlertConfig;
    const normalized = normalizeConfig(remote);
    cache = normalized;
    writeLocal(normalized, sid);
    return normalized;
  } catch {
    // 后端不可用：保留本地/默认
    return cache;
  }
}

/** 保存配置：写本地 + 推后端（后端失败不报错，本地仍生效） */
export async function saveVoiceAlertConfig(
  config: VoiceAlertConfig,
  shopId?: string,
): Promise<void> {
  const sid = shopId || currentShopId();
  const normalized = normalizeConfig(config);
  cache = normalized;
  writeLocal(normalized, sid);
  try {
    await request.put(`/api/merchant/shops/${sid}/voice-alert-config`, normalized);
  } catch {
    /* 后端不可用时本地已保存，静默忽略 */
  }
}

// ---- 兼容旧 API（设置页/播放路径复用）----

/** @deprecated 用 getVoiceAlertConfigSync().selection 替代 */
export function getVoiceSelection(shopId?: string): VoiceAlertSelection {
  return getVoiceAlertConfigSync(shopId).selection;
}

/** @deprecated 用 saveVoiceAlertConfig 替代（仅更新 selection 部分） */
export function saveVoiceSelection(sel: VoiceAlertSelection, shopId?: string): void {
  const sid = shopId || currentShopId();
  const cur = getVoiceAlertConfigSync(sid);
  const merged = { ...cur, selection: sel };
  cache = merged;
  writeLocal(merged, sid);
}

/** 取某状态的第 1 条候选文本（默认/兜底用） */
export function defaultPhraseOf(kind: AdminOrderAlertKind): string {
  const opts = VOICE_OPTIONS[kind];
  if (opts && opts.length) return opts[0].text;
  return PHRASE_POOL.default[0];
}

/** 由 optionId 取对应候选对象（找不到返回该组第一条） */
export function optionById(kind: AdminOrderAlertKind, id?: string): VoiceOption {
  const opts = VOICE_OPTIONS[kind] || [];
  return opts.find((o) => o.id === id) || opts[0] || { id: 'default_1', text: defaultPhraseOf('default') };
}

/**
 * 解析某状态当前生效的话术文本。
 * 优先用传入的选择，否则读同步缓存；无有效选择则取该组第一条。
 */
export function resolvePhrase(kind: AdminOrderAlertKind, sel?: VoiceAlertSelection): string {
  const opts = VOICE_OPTIONS[kind];
  if (!opts || !opts.length) return defaultPhraseOf('default');

  const selection = sel ?? getVoiceAlertConfigSync().selection;
  const id = selection[kind];
  return optionById(kind, id).text;
}
