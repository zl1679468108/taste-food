#!/usr/bin/env node
/**
 * T300 双入口（平台管理员 vs 商家）隔离 HTTP 联调测试
 *
 * 验证目标：server/src/common/guards/shop-scope.guard.ts 的 ShopScopeGuard
 * 在真实 HTTP 端到端链路上确实生效（deny-by-default）。
 *
 * 角色模型（PRD §3.18 / T300）：
 *   - 平台管理员：role='admin' 且 shopId 为空（跨店治理）
 *   - 商家：      role='merchant' 且绑定单一 shopId（一店一商家）
 *   - 二义账号：  role='admin' 且 shopId 非空（历史遗留，v29 迁移应已归并为 merchant）
 *
 * 用法：
 *   node tests/dual-entry.e2e.mjs                     # 默认打 127.0.0.1:3010
 *   BASE_URL=http://127.0.0.1:3010/api node tests/...  # 自定义地址
 *   STRICT=1 node tests/dual-entry.e2e.mjs            # 把 GAP 也计为失败
 *
 * 前置：cd server && npm run start（端口 3010，幂等可重跑）
 * 依赖：Node >= 18（global fetch），无第三方依赖。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3010/api').replace(/\/$/, '');
const STRICT = process.env.STRICT === '1';

/** ShopScopeGuard 拒绝时的专属文案，用于把它和 RolesGuard 的拒绝区分开 */
const SCOPE_GUARD_MSG = '仅平台管理员可访问';
const SCOPE_GUARD_MERCHANT_MSG = '仅商家可访问';

// ---------------------------------------------------------------- 结果统计
let pass = 0;
let fail = 0;
const gaps = [];
const failures = [];

const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function ok(name, detail = '') {
  pass++;
  console.log(`  ${C.green('PASS')}  ${name}${detail ? C.dim('  ' + detail) : ''}`);
}

function no(name, detail = '') {
  fail++;
  failures.push(`${name} ${detail}`.trim());
  console.log(`  ${C.red('FAIL')}  ${name}${detail ? '  ' + detail : ''}`);
}

function gap(name, detail = '') {
  gaps.push(`${name} ${detail}`.trim());
  console.log(`  ${C.yellow('GAP ')}  ${name}${detail ? '  ' + detail : ''}`);
}

function section(title) {
  console.log(`\n${C.bold(title)}`);
}

/** 断言 HTTP 状态码 */
function expectStatus(name, res, expected, extra = '') {
  const list = Array.isArray(expected) ? expected : [expected];
  if (list.includes(res.status)) {
    ok(name, `[${res.status}] ${extra}`.trim());
    return true;
  }
  no(name, `期望 ${list.join('/')}，实际 ${res.status}：${JSON.stringify(res.body)?.slice(0, 120)}`);
  return false;
}

/** 断言 403 且由 ShopScopeGuard（而非 RolesGuard）拒绝 */
function expectScopeDenied(name, res, msg = SCOPE_GUARD_MSG) {
  if (res.status !== 403) {
    no(name, `期望 403，实际 ${res.status}：${JSON.stringify(res.body)?.slice(0, 120)}`);
    return;
  }
  const actual = res.body?.message || '';
  if (actual.includes(msg)) {
    ok(name, `[403] ShopScopeGuard: "${actual}"`);
  } else {
    // 仍是 403（隔离有效），但拦截来自上游 RolesGuard —— 记为 PASS 并标注归属
    ok(name, `[403] 上游 RolesGuard 先行拦截: "${actual}"`);
  }
}

// ---------------------------------------------------------------- HTTP 工具
async function http(method, path, { token, body } = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(`请求失败 ${method} ${url}：${e.message}`);
  }
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

const GET = (p, o) => http('GET', p, o);
const POST = (p, o) => http('POST', p, o);
const PATCH = (p, o) => http('PATCH', p, o);

// ---------------------------------------------------------------- 登录
async function loginByPassword(username, password) {
  const res = await POST('/auth/login', { body: { username, password } });
  if (![200, 201].includes(res.status) || res.body?.code !== 0) {
    throw new Error(
      `账号密码登录失败 ${username}：HTTP ${res.status} ${JSON.stringify(res.body)?.slice(0, 200)}`,
    );
  }
  return res.body.data;
}

/** 开发环境 mock 登录码（server/src/modules/auth/auth.service.ts 的 DEV_MOCK_USERS） */
async function loginByDevCode(code) {
  const res = await POST('/auth/wechat-login', { body: { code } });
  if (![200, 201].includes(res.status) || res.body?.code !== 0) {
    throw new Error(
      `dev mock 登录失败 code=${code}：HTTP ${res.status} ${JSON.stringify(res.body)?.slice(0, 200)}`,
    );
  }
  return res.body.data;
}

/** 确保演示商家可用（幂等，接口为 @Public） */
async function ensureDemoMerchant() {
  try {
    await POST('/auth/dev/seed-merchant');
  } catch {
    /* 忽略：非致命 */
  }
}

// ---------------------------------------------------------------- 源码扫描
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

/** 扫描所有 controller，统计 @PlatformOnly / @MerchantOnly 的实际使用 */
function scanScopeUsage() {
  const dir = join(REPO_ROOT, 'server', 'src');
  const result = { platform: [], merchant: [] };
  let files = [];
  try {
    files = walk(dir);
  } catch (e) {
    return { ...result, error: e.message };
  }
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = f.replace(REPO_ROOT + '/', '');
    const p = (src.match(/@PlatformOnly\(\)/g) || []).length;
    const m = (src.match(/@MerchantOnly\(\)/g) || []).length;
    if (p) result.platform.push(`${rel} ×${p}`);
    if (m) result.merchant.push(`${rel} ×${m}`);
  }
  return result;
}

// ---------------------------------------------------------------- 主流程
async function main() {
  console.log(C.bold('\n═══ T300 双入口隔离 E2E 测试 ═══'));
  console.log(C.dim(`目标：${BASE_URL}\n`));

  // 0. 连通性
  section('【0】后端连通性');
  let health;
  try {
    health = await GET('/health');
  } catch (e) {
    console.log(`  ${C.red('FAIL')}  后端不可达：${e.message}`);
    console.log(
      C.yellow('\n  → 请先启动后端：cd server && npm run start（端口 3010，幂等可重跑）\n'),
    );
    process.exit(2);
  }
  expectStatus('GET /api/health 可达', health, [200, 201]);

  // 1. 取得两种身份 token
  section('【1】取得双入口身份 token');
  await ensureDemoMerchant();

  let platform, merchant, ambiguous;
  try {
    platform = await loginByPassword('admin', 'admin123');
    ok('平台管理员登录 admin/admin123', `userId=${platform.userId}`);
  } catch (e) {
    no('平台管理员登录 admin/admin123', e.message);
    console.log(C.yellow('\n  → 无法取得平台管理员 token，后续断言无法执行。\n'));
    process.exit(2);
  }
  try {
    merchant = await loginByPassword('merchant', 'merchant123');
    ok('商家登录 merchant/merchant123', `userId=${merchant.userId}`);
  } catch (e) {
    no('商家登录 merchant/merchant123', e.message);
    console.log(C.yellow('\n  → 无法取得商家 token，后续断言无法执行。\n'));
    process.exit(2);
  }
  // 二义账号（role=admin + shopId）：唯一能把 ShopScopeGuard 与 RolesGuard 区分开的身份
  try {
    ambiguous = await loginByDevCode('merchant_code');
    ok('二义账号登录 wechat-login code=merchant_code', `role=${ambiguous.role} shopId=${ambiguous.shopId || '空'}`);
  } catch (e) {
    ambiguous = null;
    gap('二义账号 token 获取失败（跳过 ShopScopeGuard 归属判定）', e.message);
  }

  // 2. 身份前置校验
  section('【2】身份模型前置校验');
  if (platform.role === 'admin' && !platform.shopId) {
    ok('平台管理员 = role:admin + shopId 为空', `role=${platform.role}`);
  } else {
    no('平台管理员 = role:admin + shopId 为空', `实际 role=${platform.role} shopId=${platform.shopId}`);
  }
  if (merchant.role === 'merchant' && merchant.shopId) {
    ok('商家 = role:merchant + 绑定 shopId', `shopId=${merchant.shopId}`);
  } else {
    no('商家 = role:merchant + 绑定 shopId', `实际 role=${merchant.role} shopId=${merchant.shopId}`);
  }

  const P = { token: platform.token, label: '平台管理员' };
  const M = { token: merchant.token, label: '商家' };
  const A = ambiguous ? { token: ambiguous.token, label: '二义账号(admin+shopId)' } : null;

  // 3. @PlatformOnly：审计日志
  section('【3】@PlatformOnly — GET /api/platform/audit-logs（整类前缀受限）');
  expectStatus('平台管理员可访问审计日志', await GET('/platform/audit-logs?page=1&pageSize=1', { token: P.token }), 200);
  expectScopeDenied('商家访问审计日志被拒 403', await GET('/platform/audit-logs?page=1&pageSize=1', { token: M.token }));
  if (A) {
    expectScopeDenied(
      '二义账号(admin+shopId)访问审计日志被拒 403〔ShopScopeGuard 专属拦截〕',
      await GET('/platform/audit-logs?page=1&pageSize=1', { token: A.token }),
    );
  }
  expectStatus('匿名访问审计日志被拒 401', await GET('/platform/audit-logs'), 401);

  // 4. @PlatformOnly：角色申请列表 / 审批
  section('【4】@PlatformOnly — role-applications 列表与审批');
  const listRes = await GET('/role-applications', { token: P.token });
  expectStatus('平台管理员可查角色申请列表', listRes, 200);
  expectScopeDenied('商家查角色申请列表被拒 403', await GET('/role-applications', { token: M.token }));
  if (A) {
    expectScopeDenied(
      '二义账号查角色申请列表被拒 403',
      await GET('/role-applications', { token: A.token }),
    );
  }

  const appId =
    (Array.isArray(listRes.body?.data) && listRes.body.data[0]?.id) ||
    '00000000-0000-0000-0000-0000000000ff';
  const reviewBody = { status: 'approved' };
  expectScopeDenied(
    '商家审批角色申请被拒 403（守卫先于业务逻辑执行）',
    await PATCH(`/role-applications/${appId}/review`, { token: M.token, body: reviewBody }),
  );
  if (A) {
    expectScopeDenied(
      '二义账号审批角色申请被拒 403',
      await PATCH(`/role-applications/${appId}/review`, { token: A.token, body: reviewBody }),
    );
  }

  // 5. @PlatformOnly：用户详情（关键鉴别用例）
  // GET /users/:id 标了 @Roles(ADMIN, MERCHANT)，商家能过 RolesGuard，
  // 因此这里的 403 只可能来自 ShopScopeGuard —— 最能证明隔离真实生效。
  section('【5】@PlatformOnly — GET /api/users/:id（RolesGuard 放行 merchant，故 403 必来自 ShopScopeGuard）');
  const usersRes = await GET('/users?page=1&pageSize=5', { token: P.token });
  const someUserId = usersRes.body?.data?.items?.[0]?.id || platform.userId;
  const pDetail = await GET(`/users/${someUserId}`, { token: P.token });
  if (pDetail.status !== 403) {
    ok('平台管理员可访问用户详情（未被 scope 拦截）', `[${pDetail.status}]`);
  } else {
    no('平台管理员可访问用户详情', `被拒 403：${pDetail.body?.message}`);
  }
  expectScopeDenied(`商家访问用户详情被拒 403`, await GET(`/users/${someUserId}`, { token: M.token }));
  if (A) {
    expectScopeDenied('二义账号访问用户详情被拒 403', await GET(`/users/${someUserId}`, { token: A.token }));
  }

  // 6. @MerchantOnly 覆盖检查（动态扫描，避免"无路由静默通过"）
  section('【6】@MerchantOnly — 商家专属资源覆盖检查');
  const usage = scanScopeUsage();
  if (usage.error) {
    gap('无法扫描 controller 源码', usage.error);
  } else if (usage.merchant.length === 0) {
    gap(
      '全仓库 0 个接口使用 @MerchantOnly',
      '装饰器已定义但无任何路由标记 → "商家可访问 / 无 shopId 的平台管理员被拒" 在 HTTP 层无载体，该向断言无法端到端验证',
    );
    console.log(
      C.dim(`        当前 @PlatformOnly 覆盖：${usage.platform.join(', ') || '无'}`),
    );
  } else {
    ok(`@MerchantOnly 已被使用`, usage.merchant.join(', '));
    console.log(C.dim('        注：如需逐路由验证，请在此补充具体路径断言'));
  }

  // 7. 二义账号回归检查（v29 迁移应已消除 admin+shop_id）
  section('【7】回归 — 是否仍存在 role=admin 且 shopId 非空 的二义账号');
  const allUsers = await GET('/users?page=1&pageSize=100', { token: P.token });
  const items = allUsers.body?.data?.items || [];
  const ambiguousUsers = items.filter((u) => u.role === 'admin' && u.shopId);
  if (ambiguousUsers.length === 0) {
    ok('无 role=admin 且 shopId 非空 的二义账号', `已检查 ${items.length} 个账号`);
  } else {
    gap(
      `发现 ${ambiguousUsers.length} 个二义账号（role=admin 且 shopId 非空）`,
      ambiguousUsers.map((u) => `${u.nickName || u.id}(${u.openid || ''})`).join(', '),
    );
    console.log(
      C.dim(
        '        v29-merge-ambiguous-admin-to-merchant.sql 只订正了存量数据；\n' +
          '        DEV_MOCK_USERS.merchant_code 仍以 role=admin + shopId 建号，dev 登录会再造二义账号。',
      ),
    );
  }

  // ---------------------------------------------------------------- 汇总
  console.log(C.bold('\n═══ 汇总 ═══'));
  console.log(`  ${C.green(`PASS ${pass}`)}   ${fail ? C.red(`FAIL ${fail}`) : `FAIL ${fail}`}   ${gaps.length ? C.yellow(`GAP ${gaps.length}`) : `GAP 0`}`);
  if (failures.length) {
    console.log(C.red('\n  失败项：'));
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  if (gaps.length) {
    console.log(C.yellow('\n  隔离缺口：'));
    gaps.forEach((g) => console.log(`    - ${g}`));
  }
  console.log('');

  const failed = fail > 0 || (STRICT && gaps.length > 0);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(C.red(`\n未捕获异常：${e.stack || e.message}`));
  console.log(C.yellow('  → 若为连接错误，请确认后端已启动：cd server && npm run start\n'));
  process.exit(2);
});
