/**
 * PC 管理后台新订单 / 售后提醒。
 *
 * 播放策略（由可靠到兜底）：
 *   1) 预生成语音文件（/sounds/alert/*.mp3，由 scripts/gen-alert-voice.mjs
 *      用豆包云端女声一次性生成，随包部署，离线可用、声音自然）
 *   2) 浏览器本地 SpeechSynthesis（无预生成文件时兜底）
 *   3) 回放 public/sounds/new-order.wav（以上均不可用时）
 *
 * - 话术由 VoiceAlertSettings 配置（每状态 3 选 1），resolvePhrase 解析。
 * - 配置（总开关/音量/重复次数）由 voiceConfig 提供，支持后端持久化（T308/T311）。
 * - 浏览器自动播放策略：首次用户交互时主动解锁音频上下文（T310），提升首播成功率；
 *   仍失败则静默降级，不影响主流程。
 */

import {
  sanitizeForSpeech,
  phraseToFile,
  ALERT_VOICE_DIR,
  type AdminOrderAlertKind,
} from './alertPhrases';
import { resolvePhrase, getVoiceAlertConfigSync } from './voiceConfig';

let lastPlayAt = 0;
const MIN_INTERVAL_MS = 800;

export type { AdminOrderAlertKind };

/** 需要语音播报的商家通知类型（均为商家视角下需听得到的 inbound 事件） */
const ORDER_ALERT_TYPES: ReadonlySet<string> = new Set([
  'order_paid',
  'order_cancel_request',
  'order_reminder',
  'rider_assigned',
  'new_review',
]);

/** 是否应播放提醒音的消息类型 */
export function shouldPlayOrderAlert(type?: string): type is AdminOrderAlertKind {
  return !!type && ORDER_ALERT_TYPES.has(type);
}

/** 用浏览器语音合成朗读（清晰优先，俏皮感由话术本身体现） */
function speak(text: string, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || synth.speaking) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.95; // 略慢，吐字清楚（>1.0 易吞音）
    utter.pitch = 1.0;
    utter.volume = volume;

    const voice = pickChineseVoice();
    if (voice) utter.voice = voice;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}

/** 为候选语音打分：质量越高分越高，挑选时取最高分（自然女声优先） */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (/neural/.test(name)) score += 100;
  else if (/online|natural/.test(name)) score += 80;
  if (/premium|enhanced|hq/.test(name)) score += 30;
  const female = /(xiaoxiao|xiaoyi|ting[- ]?ting|mei|yaoyao|huihui|yan|sin[- ]?ji|female|女)/;
  const male = /(yunxi|yunyang|kangkang|云希|云扬|康康|male|男)/;
  if (female.test(name)) score += 50;
  else if (male.test(name)) score -= 20;
  if (/(xiaoxiao|ting[- ]?ting|mei|huihui|yaoyao|kangkang|yan|xiaoyi|yunxi)/.test(name)) score += 20;
  if (/zh|chinese|中文|普通话/i.test(v.lang + v.name)) score += 10;
  if (v.lang.toLowerCase() === 'zh-cn') score += 5;
  return score;
}

/** 选一个最清晰的中文语音（按质量分排序挑选，而非取第一个） */
let cachedZhVoice: SpeechSynthesisVoice | null = null;
let voicesChangedBound = false;
function refreshZhVoice(): void {
  const voices = window.speechSynthesis.getVoices();
  const zhVoices = voices.filter(
    (v) => /^zh/i.test(v.lang) || /chinese|china|中文|普通话/i.test(v.name),
  );
  if (zhVoices.length === 0) {
    cachedZhVoice = null;
    return;
  }
  zhVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
  cachedZhVoice = zhVoices[0];
}
function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (cachedZhVoice !== null) return cachedZhVoice;

  refreshZhVoice();
  if (cachedZhVoice === null && !voicesChangedBound) {
    voicesChangedBound = true;
    window.speechSynthesis.onvoiceschanged = refreshZhVoice;
  }
  return cachedZhVoice;
}

/** 降级：回放原有提示音 */
function playFallbackSound(volume: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio('/sounds/new-order.wav');
      audio.volume = volume;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => resolve());
      }
    } catch {
      resolve();
    }
  });
}

/**
 * 播放预生成的语音文件（豆包女声）。
 * 成功 resolve；文件缺失/播放失败（含自动播放拦截）则 reject，由调用方降级。
 */
function playLocalAlert(phrase: string, volume: number): Promise<void> {
  const file = ALERT_VOICE_DIR + phraseToFile(phrase);
  const audio = new Audio(file);
  audio.volume = volume;
  return new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('预生成语音文件缺失或无法播放：' + file));
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => reject(e instanceof Error ? e : new Error('自动播放被拦截')));
    }
  });
}

/** 单次播报：预生成优先，缺失则降级语音合成，再不行回放提示音 */
async function playAlertOnce(phrase: string, volume: number): Promise<void> {
  try {
    await playLocalAlert(phrase, volume);
    return;
  } catch {
    /* 预生成失败，降级 */
  }
  if ('speechSynthesis' in window) {
    await speak(sanitizeForSpeech(phrase), volume);
    return;
  }
  await playFallbackSound(volume);
}

// ===== 首次交互解锁音频上下文（T310）=====

let audioUnlockBound = false;
/**
 * 绑定一次性用户交互监听：首次 pointerdown/keydown 时主动解锁音频（HTMLAudio + speechSynthesis），
 * 提升后续通知自动播放的成功率。仅绑定一次。
 */
function bindFirstInteractionUnlock(): void {
  if (audioUnlockBound || typeof window === 'undefined') return;
  audioUnlockBound = true;

  const unlock = () => {
    // HTMLAudioElement：播放一个静音音频以解锁音频输出
    try {
      const a = new Audio();
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* ignore */
    }
    // speechSynthesis：触发一次空朗读以解锁中文语音
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* ignore */
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

/** 模块加载即武装解锁监听 */
bindFirstInteractionUnlock();

let localPlaying = false;

/**
 * 播放新订单提醒（应用配置：总开关 / 音量 / 重复次数）。
 * 预生成语音优先，缺失则降级浏览器语音合成，再不行回放提示音。
 * 触发频率受 800ms 节流限制，避免高峰期语音叠放。
 */
export function playAdminOrderAlert(kind: AdminOrderAlertKind | string = 'default'): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastPlayAt < MIN_INTERVAL_MS) return;
  lastPlayAt = now;

  const config = getVoiceAlertConfigSync();
  if (!config.enabled) return; // 总开关关闭：不播报

  const alertKind: AdminOrderAlertKind =
    kind && ORDER_ALERT_TYPES.has(kind) ? (kind as AdminOrderAlertKind) : 'default';
  const phrase = resolvePhrase(alertKind);
  const volume = typeof config.volume === 'number' ? config.volume : 1;
  const repeat = Math.min(3, Math.max(1, Math.round(config.repeat || 1)));

  if (localPlaying) return; // 防重入
  localPlaying = true;
  (async () => {
    for (let i = 0; i < repeat; i++) {
      try {
        await playAlertOnce(phrase, volume);
      } catch {
        /* ignore */
      }
    }
    localPlaying = false;
  })();
}

/**
 * 设置页「试听」用：播放指定话术的预生成语音（不触发节流、不写入日志、不计入重复）。
 * 优先预生成 MP3，缺失则降级浏览器语音合成。
 */
export function previewVoicePhrase(phrase: string): void {
  if (typeof window === 'undefined') return;
  const volume = (() => {
    const c = getVoiceAlertConfigSync();
    return typeof c.volume === 'number' ? c.volume : 1;
  })();
  (async () => {
    await playAlertOnce(phrase, volume);
  })();
}
