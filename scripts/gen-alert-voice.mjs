#!/usr/bin/env node
/**
 * 一次性生成「新订单语音播报」的固定话术音频（豆包 / 火山引擎 TTS）。
 *
 * 用法：
 *   node scripts/gen-alert-voice.mjs --key <火山引擎APIKey> [--voice <音色ID>] [--out <目录>]
 *
 * 说明：
 *   - 文案与文件名哈希必须与 admin/src/utils/alertPhrases.ts 完全一致，否则播放时找不到文件。
 *   - 生成的文件位于 admin/public/sounds/alert/，随前端包部署，离线可播。
 *   - 终端中文会打印「文本 → 文件名」映射，便于核对。
 *
 * 依赖：Node 18+ 内置 fetch / crypto（无需额外安装）。
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ===== 与 admin/src/utils/alertPhrases.ts 保持一致的单一数据源（每重要状态 3 条候选） =====
const PHRASE_POOL = {
  order_paid: [
    '您有一笔新订单，请及时处理',
    '新订单已支付，请尽快接单',
    '有新的待接订单，请关注处理',
  ],
  order_cancel_request: [
    '有顾客发起取消申请，请尽快审核',
    '收到一笔取消申请，请及时处理',
    '顾客申请取消订单，请确认',
  ],
  // 顾客催单
  order_reminder: [
    '温馨提示，有顾客正在催单，请加快出餐',
    '顾客催单提醒，请尽快处理当前订单',
    '您有一笔订单被催单，请及时处理',
  ],
  // 骑手接单 / 到店取餐出发
  rider_assigned: [
    '骑手已接单，外卖订单正在配送途中',
    '骑手已取餐出发，请关注配送进度',
    '外卖订单骑手已接单，即将送达顾客',
  ],
  // 顾客完成评价
  new_review: [
    '您收到一条新的顾客评价，请查看',
    '有顾客完成评价，感谢您的用心',
    '新的评价来啦，快看看顾客的反馈',
  ],
  default: ['您有新的消息'],
};

function sanitizeForSpeech(text) {
  return text.replace(/[~～]/g, '').trim();
}

function phraseToFile(phrase) {
  const key = sanitizeForSpeech(phrase);
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return `alert-${h.toString(16)}.mp3`;
}

// ===== 命令行参数 =====
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--key') out.key = argv[++i];
    else if (a === '--voice') out.voice = argv[++i];
    else if (a === '--out') out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const API_KEY = args.key || process.env.VOLC_API_KEY;
const VOICE = args.voice || 'zh_female_tianmeitaozi_uranus_bigtts'; // 温柔桃子 2.0，温润规范
const OUT_DIR = args.out
  ? resolve(args.out)
  : resolve(PROJECT_ROOT, 'admin/public/sounds/alert');

if (!API_KEY) {
  console.error('❌ 缺少火山引擎 API Key。请用 --key <KEY> 或设置环境变量 VOLC_API_KEY。');
  process.exit(1);
}

const ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

async function genOne(text) {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'X-Api-Resource-Id': 'seed-tts-2.0',
      'X-Api-Request-Id': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      req_params: {
        text,
        speaker: VOICE,
        audio_params: { format: 'mp3' },
      },
    }),
  });

  // 豆包 unidirectional 接口返回「换行分隔的多段 JSON 流」：
  // 首段 {"code":0,"message":"","data":"<base64 音频>"}，后续为使用量等元数据段。
  // 也可能某些版本直接返回二进制。统一按行解析，拼接所有 data 字段。
  const ab = await resp.arrayBuffer();
  let buf = Buffer.from(ab);

  const head = buf.subarray(0, 1).toString('utf-8');
  if (head === '{') {
    const text = buf.toString('utf-8');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    let b64 = '';
    let bizErr = null;
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        if (j.code && j.code !== 0) {
          bizErr = `业务错误 code=${j.code}: ${j.message || ''}`;
          continue;
        }
        if (j.data) b64 += j.data;
      } catch {
        /* 忽略无法解析的行 */
      }
    }
    if (bizErr && !b64) throw new Error(bizErr);
    if (!b64) {
      if (bizErr) throw new Error(bizErr);
      throw new Error('返回 JSON 但无音频 data 字段');
    }
    buf = Buffer.from(b64, 'base64');
  }

  if (!resp.ok && head !== '{') {
    throw new Error(`HTTP ${resp.status}: ${buf.toString('utf-8').slice(0, 300)}`);
  }
  return buf;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const all = [];
  for (const kind of Object.keys(PHRASE_POOL)) {
    for (const phrase of PHRASE_POOL[kind]) {
      all.push(phrase);
    }
  }

  console.log(`音色: ${VOICE}`);
  console.log(`输出目录: ${OUT_DIR}`);
  console.log(`共 ${all.length} 条话术\n`);

  let ok = 0;
  for (const phrase of all) {
    const file = phraseToFile(phrase);
    const cleaned = sanitizeForSpeech(phrase);
    try {
      const buf = await genOne(cleaned);
      if (!buf || buf.length === 0) throw new Error('返回空音频');
      await writeFile(resolve(OUT_DIR, file), buf);
      console.log(`✔ ${file}  (${(buf.length / 1024).toFixed(1)} KB)  ← ${cleaned}`);
      ok++;
    } catch (e) {
      console.error(`✘ ${file}  失败: ${e.message}  ← ${cleaned}`);
    }
    // 轻微限速，避免触发频率限制
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n完成：${ok}/${all.length} 条生成成功`);
  if (ok < all.length) process.exit(2);
}

main().catch((e) => {
  console.error('脚本异常:', e.message);
  process.exit(1);
});
