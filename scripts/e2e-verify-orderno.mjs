#!/usr/bin/env node
/**
 * T264 闭环验证：订单号「高水位流水」删单不撞号 —— 端到端真实链路验证
 *
 * 验证场景（走真实 HTTP API + 真实 Supabase）：
 *   1. 下单 A、B、C，确认流水连续递增
 *   2. 删除中间单 B（模拟历史删单）
 *   3. 再下单 D —— 旧逻辑(count+1)会撞上已存在的 C；新逻辑(max+1)应生成 C+1
 *
 * 全程使用 dine_in（堂食）避免地址依赖，测试单在结束时自动清理。
 *
 * 用法：
 *   NODE_OPTIONS="--use-env-proxy" NODE_PATH="$PWD/node_modules" node scripts/e2e-verify-orderno.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API = process.env.API_BASE || 'http://127.0.0.1:3010/api';
const SHOP_ID = '00000000-0000-0000-0000-000000000001';
const MENU_ITEM_ID = 'd0000000-0000-0000-0000-000000000002'; // 招牌烤鸡翅 ¥18
const DELIVERY_TYPE = 'dine_in';
const TEST_TAG = 'E2E-T264-VERIFY';

// ---------- Supabase ----------
function loadEnv() {
  const raw = fs.readFileSync(path.join(ROOT, 'server/.env.development'), 'utf8');
  const pick = (k) => {
    const m = raw.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim() : '';
  };
  return { url: pick('SUPABASE_URL'), key: pick('SUPABASE_SERVICE_ROLE_KEY') };
}
const { url, key } = loadEnv();
const sb = createClient(url, key);

// ---------- HTTP ----------
async function call(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

// ---------- 工具 ----------
const seqOf = (no) => (typeof no === 'string' && /^TF\d{8}[DPI]\d{2}(\d{4})$/.test(no)
  ? parseInt(no.slice(-4), 10) : NaN);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const created = []; // 记录所有创建的订单 id，用于最终清理

async function hardDelete(orderId) {
  await sb.from('tf_order_items').delete().eq('order_id', orderId);
  await sb.from('tf_payments').delete().eq('order_id', orderId);
  await sb.from('tf_delivery_info').delete().eq('order_id', orderId);
  const { error } = await sb.from('tf_orders').delete().eq('id', orderId);
  if (error) throw new Error(`删除订单失败 ${orderId}: ${error.message}`);
}

async function placeOrder(token, label) {
  const { status, json } = await call('/orders', {
    method: 'POST',
    token,
    body: {
      shopId: SHOP_ID,
      deliveryType: DELIVERY_TYPE,
      tableNo: 'T99',
      remark: `${TEST_TAG} ${label}`,
      items: [{ menuItemId: MENU_ITEM_ID, quantity: 1 }],
    },
  });
  if (status !== 201 && json?.code !== 0) {
    throw new Error(`下单 ${label} 失败 [${status}]: ${JSON.stringify(json).slice(0, 400)}`);
  }
  const o = json.data;
  created.push(o.id);
  return { id: o.id, orderNo: o.orderNo || o.order_no };
}

// ---------- 主流程 ----------
async function main() {
  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? '  ✅' : '  ❌'} ${name}\n     ${detail}`);
  };

  console.log('═'.repeat(72));
  console.log('T264 端到端验证：订单号高水位流水（删单不撞号）');
  console.log('═'.repeat(72));

  // 0. 登录
  const { status: ls, json: lj } = await call('/auth/wechat-login', {
    method: 'POST',
    body: { code: 'customer_code', nickName: '测试顾客' },
  });
  if (ls !== 200 && ls !== 201) throw new Error(`登录失败 [${ls}]: ${JSON.stringify(lj).slice(0, 300)}`);
  const token = lj.data?.token || lj.data?.accessToken;
  if (!token) throw new Error(`登录未返回 token: ${JSON.stringify(lj).slice(0, 300)}`);
  console.log(`\n【0】登录成功  userId=${lj.data?.userInfo?.id || lj.data?.user?.id || 'n/a'}`);

  // 1. 基线快照
  const dk = todayKey();
  const { data: before } = await sb
    .from('tf_orders').select('id,order_no')
    .eq('shop_id', SHOP_ID).eq('delivery_type', DELIVERY_TYPE)
    .like('order_no', `TF${dk}I%`);
  const baseMax = Math.max(0, ...(before || []).map((r) => seqOf(r.order_no)).filter(Number.isFinite));
  console.log(`【1】基线：今日(${dk})堂食已有 ${before?.length || 0} 单，最大流水=${String(baseMax).padStart(4, '0')}`);

  // 2. 连下三单
  console.log('\n【2】连续下单 A / B / C，验证流水连续递增');
  const A = await placeOrder(token, 'A');
  const B = await placeOrder(token, 'B');
  const C = await placeOrder(token, 'C');
  console.log(`     A=${A.orderNo}   B=${B.orderNo}   C=${C.orderNo}`);

  const [sA, sB, sC] = [A, B, C].map((x) => seqOf(x.orderNo));
  record('格式合规',
    [A, B, C].every((x) => /^TF\d{8}I\d{2}\d{4}$/.test(x.orderNo)),
    `三单均匹配 TF+YYYYMMDD+I+店铺2位+流水4位`);
  record('流水连续递增',
    sB === sA + 1 && sC === sB + 1,
    `${sA} → ${sB} → ${sC}（期望逐 +1）`);
  record('接续历史最大流水',
    sA === baseMax + 1,
    `基线最大 ${baseMax} → 首单 ${sA}（期望 ${baseMax + 1}）`);

  // 3. 删除中间单 B —— 这是复现 bug 的关键步骤
  console.log(`\n【3】删除中间单 B (${B.orderNo})，模拟历史删单造成的计数空洞`);
  await hardDelete(B.id);
  const idxB = created.indexOf(B.id);
  if (idxB >= 0) created.splice(idxB, 1);
  const { count: nowCount } = await sb
    .from('tf_orders').select('id', { count: 'exact', head: true })
    .eq('shop_id', SHOP_ID).eq('delivery_type', DELIVERY_TYPE)
    .like('order_no', `TF${dk}I%`);
  console.log(`     删除后当日堂食单数=${nowCount}，剩余最大流水=${sC}`);
  console.log(`     ⚠️ 旧逻辑(count+1) 此刻会生成流水 ${nowCount + 1}，与已存在的 ${sC} 撞号`);

  // 4. 再下单 D —— 核心验证
  console.log('\n【4】删单后再下单 D，验证是否撞号');
  const D = await placeOrder(token, 'D');
  const sD = seqOf(D.orderNo);
  console.log(`     D=${D.orderNo}`);

  record('新单未撞号（核心）',
    sD !== sC && sD !== sA,
    `D 流水=${sD}，与存活单 A=${sA} / C=${sC} 均不同`);
  record('新单为高水位 max+1（核心）',
    sD === sC + 1,
    `期望 ${sC + 1}（存活最大 ${sC} +1），实际 ${sD}`);
  record('未发生序号回退',
    sD > sC,
    `D(${sD}) > 删单前最大(${sC})`);

  // 5. 唯一性复核
  const { data: after } = await sb
    .from('tf_orders').select('order_no')
    .eq('shop_id', SHOP_ID).eq('delivery_type', DELIVERY_TYPE)
    .like('order_no', `TF${dk}I%`);
  const nos = (after || []).map((r) => r.order_no);
  record('全库订单号无重复', new Set(nos).size === nos.length,
    `今日堂食 ${nos.length} 单，去重后 ${new Set(nos).size} 个`);

  return results;
}

// ---------- 执行 + 清理 ----------
let exitCode = 0;
let results = [];
try {
  results = await main();
} catch (e) {
  console.error(`\n❌ 验证中断: ${e.message}`);
  exitCode = 1;
} finally {
  console.log('\n【5】清理测试数据');
  for (const id of created) {
    try {
      await hardDelete(id);
      console.log(`     已删除测试单 ${id}`);
    } catch (e) {
      console.log(`     ⚠️ 清理失败 ${id}: ${e.message}`);
      exitCode = 1;
    }
  }
  const dk = todayKey();
  const { data: leftover } = await sb
    .from('tf_orders').select('id,order_no,remark')
    .eq('shop_id', SHOP_ID).like('remark', `%${TEST_TAG}%`);
  console.log(`     残留测试单：${leftover?.length || 0} 条${leftover?.length ? ' → ' + leftover.map((x) => x.order_no).join(', ') : ' ✅ 已清空'}`);

  if (results.length) {
    const passed = results.filter((r) => r.pass).length;
    console.log('\n' + '═'.repeat(72));
    console.log(`结果：${passed}/${results.length} 项通过 ${passed === results.length ? '✅ 全部通过' : '❌ 存在失败'}`);
    console.log('═'.repeat(72));
    if (passed !== results.length) exitCode = 1;
  }
}
process.exit(exitCode);
