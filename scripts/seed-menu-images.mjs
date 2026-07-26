#!/usr/bin/env node
/**
 * 将 client/src/assets/dishes 本地菜品图批量导入图库，并按菜名回填 menu-items.imageUrl。
 *
 * 运行方式（仓库根目录）：
 *   node scripts/seed-menu-images.mjs
 *
 * 环境变量：
 *   API_BASE      默认 http://127.0.0.1:3010/api
 *   ADMIN_TOKEN   已有管理员 Bearer token（优先）；缺省则自动 wechat-login(admin_code)
 *   SHOP_ID       默认 00000000-0000-0000-0000-000000000001
 *   DRY_RUN=1     只匹配不上传/不 PATCH
 *   FORCE=1       即使菜品已有 imageUrl 也覆盖
 *
 * 依赖：Node 18+（原生 fetch / FormData / Blob），后端需可访问。
 * 上传优先 POST /storage/images/menu/batch；失败则回退逐张 POST /storage/images/menu。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DISHES_DIR = join(ROOT, 'client/src/assets/dishes');

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3010/api').replace(/\/$/, '');
const SHOP_ID = process.env.SHOP_ID || '00000000-0000-0000-0000-000000000001';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';

/** 文件名（无扩展名）→ 优先匹配的菜品中文名（与 seed / dish-images 对齐） */
const FILE_TO_DISH_NAMES = {
  'lamb-ribs': ['秘制烤羊排'],
  'chicken-wings': ['招牌烤鸡翅'],
  'chicken-gizzard': ['烤鸡胗'],
  'beef-skewer': ['炭烤牛肉串'],
  'lamb-skewer': ['香辣羊肉串'],
  'spare-ribs': ['蜜汁烤排骨'],
  'grilled-shrimp': ['烤大虾', '烤鱿鱼须'],
  eggplant: ['蒜蓉烤茄子', '烤茄子'],
  enoki: ['锡纸金针菇', '烤金针菇'],
  chives: ['烤韭菜'],
  potato: ['烤土豆片'],
  corn: ['烤玉米'],
  cola: ['可乐'],
  sprite: ['雪碧'],
  beer: ['青岛啤酒', '冰镇啤酒'],
  water: ['矿泉水'],
  'plum-drink': ['酸梅汤'],
  'cold-noodles': ['烤冷面'],
  mantou: ['烤馒头片'],
  toast: ['烤面包片'],
  'fried-rice': ['炒饭'],
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function log(...args) {
  console.log('[seed-menu-images]', ...args);
}

function warn(...args) {
  console.warn('[seed-menu-images]', ...args);
}

function fail(message, err) {
  console.error('[seed-menu-images]', message, err?.message || err || '');
  process.exitCode = 1;
}

async function api(path, { method = 'GET', token, body, headers } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.message || text || res.statusText;
    const error = new Error(`HTTP ${res.status} ${method} ${url}: ${msg}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }

  if (json && typeof json.code === 'number' && json.code !== 0) {
    const error = new Error(json.message || `API code ${json.code}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }

  return json?.data !== undefined ? json.data : json;
}

async function resolveAdminToken() {
  if (process.env.ADMIN_TOKEN) {
    log('使用环境变量 ADMIN_TOKEN');
    return process.env.ADMIN_TOKEN.trim();
  }

  log('ADMIN_TOKEN 未设置，自动登录 admin_code …');
  const data = await api('/auth/wechat-login', {
    method: 'POST',
    body: { code: 'admin_code', nickName: '管理员' },
  });
  const token = data?.token;
  if (!token) throw new Error('登录成功但未返回 token');
  log(`登录成功 role=${data.role || 'admin'} shopId=${data.shopId || SHOP_ID}`);
  return token;
}

function listDishFiles() {
  const entries = readdirSync(DISHES_DIR);
  return entries
    .filter((name) => IMAGE_EXTS.has(extname(name).toLowerCase()))
    .map((name) => {
      const fullPath = join(DISHES_DIR, name);
      const st = statSync(fullPath);
      return {
        name,
        base: basename(name, extname(name)),
        fullPath,
        size: st.size,
        buffer: readFileSync(fullPath),
        mime:
          extname(name).toLowerCase() === '.png'
            ? 'image/png'
            : extname(name).toLowerCase() === '.webp'
              ? 'image/webp'
              : 'image/jpeg',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mimeToExt(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * 批量上传。约定响应：
 *   data: Array<{ url, path, originalName? | filename? | name? }>
 * 或 data: { items: [...] }
 */
async function uploadBatch(files, token) {
  const form = new FormData();
  for (const file of files) {
    const blob = new Blob([file.buffer], { type: file.mime });
    // 兼容常见字段名
    form.append('images', blob, file.name);
    form.append('files', blob, file.name);
  }
  form.append('shopId', SHOP_ID);

  const data = await api('/storage/images/menu/batch', {
    method: 'POST',
    token,
    body: form,
  });

  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list.map((item, index) => ({
    originalName: item.originalName || item.filename || item.name || files[index]?.name,
    url: item.url,
    path: item.path,
  }));
}

async function uploadSingle(file, token) {
  const form = new FormData();
  const blob = new Blob([file.buffer], { type: file.mime });
  form.append('image', blob, file.name);
  form.append('originalName', file.name);
  const data = await api('/storage/images/menu', {
    method: 'POST',
    token,
    body: form,
  });
  return {
    originalName: file.name,
    url: data?.url,
    path: data?.path,
  };
}

async function uploadAll(files, token) {
  if (files.length === 0) return [];

  try {
    log(`尝试 batch 上传 ${files.length} 张 → POST /storage/images/menu/batch`);
    const results = await uploadBatch(files, token);
    if (!results.length || results.some((r) => !r.url)) {
      throw new Error('batch 响应缺少 url');
    }
    log(`batch 上传成功 ${results.length} 张`);
    return results;
  } catch (err) {
    warn(`batch 不可用，回退逐张上传: ${err.message}`);
    const results = [];
    for (const file of files) {
      log(`  上传 ${file.name} (${file.size} bytes)`);
      const one = await uploadSingle(file, token);
      if (!one.url) throw new Error(`单张上传未返回 url: ${file.name}`);
      results.push(one);
      log(`  → ${one.url}`);
    }
    return results;
  }
}

function normalizeName(name) {
  return String(name || '').trim();
}

/** 为每个本地文件找到最合适的菜单菜品（精确名优先，其次包含关系） */
function matchMenuItems(fileBase, menuItems, usedIds) {
  const candidates = FILE_TO_DISH_NAMES[fileBase] || [];
  const matched = [];

  for (const dishName of candidates) {
    const exact = menuItems.find(
      (item) => !usedIds.has(item.id) && normalizeName(item.name) === dishName,
    );
    if (exact) {
      matched.push(exact);
      usedIds.add(exact.id);
    }
  }

  if (matched.length > 0) return matched;

  // 兜底：文件名关键词出现在菜名中（如 enoki → 金针菇 已在映射里；此处用 base 片段）
  const loose = menuItems.filter((item) => {
    if (usedIds.has(item.id)) return false;
    const n = normalizeName(item.name);
    return candidates.some((c) => n.includes(c) || c.includes(n));
  });
  for (const item of loose) {
    matched.push(item);
    usedIds.add(item.id);
  }
  return matched;
}

async function main() {
  log(`API_BASE=${API_BASE}`);
  log(`SHOP_ID=${SHOP_ID}`);
  log(`DISHES_DIR=${DISHES_DIR}`);
  log(`DRY_RUN=${DRY_RUN} FORCE=${FORCE}`);

  const files = listDishFiles();
  if (files.length === 0) {
    fail(`未找到菜品图：${DISHES_DIR}`);
    return;
  }
  log(`本地菜品图 ${files.length} 张`);

  const menuItems = await api(`/menu-items?shop_id=${encodeURIComponent(SHOP_ID)}`);
  if (!Array.isArray(menuItems)) {
    fail('GET /menu-items 返回非数组');
    return;
  }
  log(`店铺菜品 ${menuItems.length} 道`);

  const token = DRY_RUN ? null : await resolveAdminToken();

  /** @type {Map<string, { url: string, path?: string }>} */
  const uploadedByFile = new Map();

  if (!DRY_RUN) {
    const uploaded = await uploadAll(files, token);
    for (const file of files) {
      const hit =
        uploaded.find((u) => u.originalName === file.name) ||
        uploaded.find((u) => u.originalName && basename(u.originalName) === file.name);
      if (hit?.url) {
        uploadedByFile.set(file.name, hit);
      }
    }
    // 若 batch 未带回 originalName，按顺序对齐
    if (uploadedByFile.size === 0 && uploaded.length === files.length) {
      files.forEach((file, i) => {
        if (uploaded[i]?.url) uploadedByFile.set(file.name, uploaded[i]);
      });
    }
  } else {
    for (const file of files) {
      uploadedByFile.set(file.name, {
        url: `https://example.invalid/menu-images/dry-run/${file.base}.${mimeToExt(file.mime)}`,
      });
    }
  }

  const usedIds = new Set();
  let patched = 0;
  let skipped = 0;
  let unmatchedFiles = 0;

  for (const file of files) {
    const upload = uploadedByFile.get(file.name);
    if (!upload?.url) {
      warn(`跳过（无上传 url）: ${file.name}`);
      unmatchedFiles += 1;
      continue;
    }

    const targets = matchMenuItems(file.base, menuItems, usedIds);
    if (targets.length === 0) {
      warn(`未匹配到菜品: ${file.name}（映射 ${JSON.stringify(FILE_TO_DISH_NAMES[file.base] || [])}）`);
      unmatchedFiles += 1;
      continue;
    }

    for (const item of targets) {
      const hasUrl = Boolean(item.imageUrl && String(item.imageUrl).trim());
      if (hasUrl && !FORCE) {
        log(`跳过已有图: ${item.name} → ${item.imageUrl}`);
        skipped += 1;
        continue;
      }

      log(`${DRY_RUN ? '[DRY] ' : ''}PATCH ${item.name} ← ${file.name}`);
      if (!DRY_RUN) {
        await api(`/menu-items/${item.id}`, {
          method: 'PATCH',
          token,
          body: { imageUrl: upload.url },
        });
      }
      patched += 1;
      item.imageUrl = upload.url;
    }
  }

  // 报告仍无图的菜品
  const stillEmpty = menuItems.filter((item) => !item.imageUrl || !String(item.imageUrl).trim());
  if (stillEmpty.length) {
    warn(`仍无 imageUrl 的菜品 (${stillEmpty.length}): ${stillEmpty.map((i) => i.name).join('、')}`);
  }

  log('完成', {
    files: files.length,
    uploaded: uploadedByFile.size,
    patched,
    skipped,
    unmatchedFiles,
    stillEmpty: stillEmpty.length,
  });
}

main().catch((err) => {
  fail('执行失败', err);
  process.exit(1);
});
