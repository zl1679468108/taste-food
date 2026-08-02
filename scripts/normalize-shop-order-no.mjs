// 规范化目标店铺的 shop_no 与订单 order_no，使其严格符合后端生成规则。
//   订单号规则: TF + YYYYMMDD(本地Asia/Shanghai) + 配送类型码(D/P/I) + 店铺序号2位 + 当日流水4位
//   店铺号规则: SH + YY + MM + 5位顺序号（按 created_at 升序在全表中的序号）
// 用法:
//   node normalize-shop-order-no.mjs            # dry-run，仅打印将要变更
//   node normalize-shop-order-no.mjs --apply    # 真正写库（两阶段，避免唯一索引瞬时冲突）
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fvggqgeiwewsjojargxe.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('缺少环境变量 SUPABASE_SERVICE_KEY，请先在本地 shell 执行 `export SUPABASE_SERVICE_KEY=<service_role_key>` 再运行本脚本。');
  process.exit(1);
}
const TARGET_SHOP = '00000000-0000-0000-0000-000000000001';
const APPLY = process.argv.includes('--apply');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DELIVERY_CODE = { delivery: 'D', pickup: 'P', dine_in: 'I' };

// 按 Asia/Shanghai 计算 YYYYMMDD（与后端 new Date() 本地时区一致）
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function localDateKey(iso) {
  // en-CA => YYYY-MM-DD
  return dateFmt.format(new Date(iso)).replaceAll('-', '');
}

async function computeShopSeq(shopId) {
  const { data, error } = await supabase
    .from('tf_shops')
    .select('id, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const idx = data.findIndex((s) => s.id === shopId);
  const seq = idx >= 0 ? idx + 1 : data.length + 1;
  return String(seq).padStart(2, '0');
}

async function main() {
  console.log(`模式: ${APPLY ? '★ APPLY（写库）' : 'dry-run（只读预览）'}`);

  const shopSeq = await computeShopSeq(TARGET_SHOP);
  console.log(`目标店铺序号(2位): ${shopSeq}`);

  const { data: orders, error } = await supabase
    .from('tf_orders')
    .select('id, order_no, delivery_type, status, created_at')
    .eq('shop_id', TARGET_SHOP)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // 分组按 (dateKey, delivery_type)，组内按 created_at 升序分配流水
  const seqCounter = {};
  const plan = [];
  for (const o of orders) {
    const dateKey = localDateKey(o.created_at);
    const code = DELIVERY_CODE[o.delivery_type] ?? 'X';
    const gk = `${dateKey}:${o.delivery_type}`;
    const seq = (seqCounter[gk] = (seqCounter[gk] || 0) + 1);
    const target = `TF${dateKey}${code}${shopSeq}${String(seq).padStart(4, '0')}`;
    plan.push({ id: o.id, from: o.order_no, to: target, changed: o.order_no !== target });
  }

  const changes = plan.filter((p) => p.changed);
  console.log(`\n订单总数: ${plan.length}，需变更: ${changes.length}`);
  if (changes.length === 0) {
    console.log('所有订单号已符合规则，无需变更。');
  } else {
    console.log('\n---- 变更明细 ----');
    changes.forEach((c) => console.log(`${c.from ?? 'NULL'}  ->  ${c.to}   (id=${c.id})`));
  }

  // 校验目标订单号在计划内唯一
  const seen = new Set();
  for (const p of plan) {
    if (seen.has(p.to)) throw new Error(`计划内订单号重复: ${p.to}`);
    seen.add(p.to);
  }

  if (!APPLY || changes.length === 0) {
    console.log(`\n${APPLY ? '无变更，' : ''}未写库。${APPLY ? '' : '如需执行请加 --apply。'}`);
    return;
  }

  // 两阶段写入，规避 order_no 唯一索引瞬时冲突
  console.log('\n阶段1: 将待变更订单临时置为 TMP_<id> ...');
  for (const c of changes) {
    const { error: e1 } = await supabase
      .from('tf_orders')
      .update({ order_no: `TMP_${c.id.slice(0, 8)}` })
      .eq('id', c.id);
    if (e1) throw new Error(`阶段1失败 id=${c.id}: ${e1.message}`);
  }
  console.log('阶段2: 写入规范化订单号 ...');
  for (const c of changes) {
    const { error: e2 } = await supabase
      .from('tf_orders')
      .update({ order_no: c.to })
      .eq('id', c.id);
    if (e2) throw new Error(`阶段2失败 id=${c.id}: ${e2.message}`);
    console.log(`  ✔ ${c.to} (id=${c.id})`);
  }
  console.log(`\n完成，共更新 ${changes.length} 条订单号。`);
}

main().catch((e) => {
  console.error('执行失败:', e.message || e);
  process.exit(1);
});
