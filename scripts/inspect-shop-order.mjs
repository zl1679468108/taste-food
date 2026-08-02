// 只读：查看当前店铺与订单的格式现状
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fvggqgeiwewsjojargxe.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('缺少环境变量 SUPABASE_SERVICE_KEY，请先在本地 shell 执行 `export SUPABASE_SERVICE_KEY=<service_role_key>` 再运行本脚本。');
  process.exit(1);
}
const TARGET_SHOP = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function j(v) {
  return JSON.stringify(v, null, 2);
}

async function main() {
  // 1. 所有店铺（按 created_at 升序，用于推导店铺序号）
  const { data: shops, error: shopErr } = await supabase
    .from('tf_shops')
    .select('id, name, shop_no, created_at')
    .order('created_at', { ascending: true });
  if (shopErr) throw shopErr;

  console.log('==== 全部店铺（按 created_at 升序）====');
  shops.forEach((s, i) => {
    console.log(
      `#${String(i + 1).padStart(2, '0')} id=${s.id} shop_no=${s.shop_no ?? 'NULL'} name=${s.name} created_at=${s.created_at}`,
    );
  });

  const idx = shops.findIndex((s) => s.id === TARGET_SHOP);
  console.log(`\n目标店铺在全表中的序号: ${idx >= 0 ? idx + 1 : '未找到'}`);

  // 2. 目标店铺全部订单
  const { data: orders, error: ordErr } = await supabase
    .from('tf_orders')
    .select('id, order_no, delivery_type, status, created_at')
    .eq('shop_id', TARGET_SHOP)
    .order('created_at', { ascending: true });
  if (ordErr) throw ordErr;

  console.log(`\n==== 目标店铺订单总数: ${orders.length} ====`);
  const nullNo = orders.filter((o) => !o.order_no);
  const badFmt = orders.filter(
    (o) => o.order_no && !/^TF\d{8}[DPI]\d{2}\d{4}$/.test(o.order_no),
  );
  console.log(`order_no 为空: ${nullNo.length}`);
  console.log(`order_no 格式不符合规则: ${badFmt.length}`);

  console.log('\n---- 前 30 条订单明细 ----');
  orders.slice(0, 30).forEach((o) => {
    const ok = o.order_no && /^TF\d{8}[DPI]\d{2}\d{4}$/.test(o.order_no);
    console.log(
      `${o.created_at} | ${o.delivery_type.padEnd(9)} | ${o.status.padEnd(15)} | order_no=${(o.order_no ?? 'NULL').padEnd(20)} ${ok ? '✅' : '❌'} | id=${o.id}`,
    );
  });

  // 按 (日期, 配送类型) 分组统计，便于规划回填
  const byGroup = {};
  for (const o of orders) {
    const d = new Date(o.created_at);
    const dateKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const k = `${dateKey}:${o.delivery_type}`;
    byGroup[k] = (byGroup[k] || 0) + 1;
  }
  console.log('\n---- 按(日期:配送类型)分组的订单数 ----');
  Object.entries(byGroup)
    .sort()
    .forEach(([k, c]) => console.log(`${k} => ${c}`));
}

main().catch((e) => {
  console.error('查询失败:', e.message || e);
  process.exit(1);
});
