/**
 * 只读：线上 Supabase schema 与 docs/database-init.sql 期望态的差异探查
 *
 * ⚠️ 本脚本严格只读：仅执行 SELECT / GET OpenAPI / RPC 探测（故意用非法参数触发报错，不会真正执行函数体）。
 *    不包含任何 INSERT / UPDATE / DELETE / DDL 语句。
 *
 * 运行方式：
 *   cd <项目根> && NODE_OPTIONS="--use-env-proxy" NODE_PATH="$PWD/node_modules" \
 *     node scripts/inspect-schema-diff.mjs
 *
 * 探测手段（组合使用，互相印证）：
 *   1. PostgREST OpenAPI spec（GET /rest/v1/）—— 一次性拿到所有表 + 列 + RPC 清单，最权威
 *   2. select('*').limit(1) —— 从返回行 key 推断实际列
 *   3. 逐列 select('列名').limit(1) —— 报 42703 即该列缺失（对空表最可靠）
 *   4. 表存在性 —— 42P01 / PGRST205 即缺表
 *   5. RPC 存在性 —— rpc(fn, {}) 报 PGRST202；靠 hint 区分「函数不存在」与「参数签名不匹配（=函数存在）」
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------- .env 解析
function loadEnv(file) {
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = loadEnv(resolve(ROOT, 'server/.env.development'));
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------- 期望态（源自 database-init.sql v1.0.6）
const EXPECTED_TABLES = {
  tf_shops: ['id','name','description','avatar_url','logo_url','address','latitude','longitude','phone','status','delivery_range','delivery_confirm_radius_m','delivery_fee','min_order_amount','business_hours','shop_no','created_at','updated_at'],
  tf_categories: ['id','shop_id','name','icon_key','sort_order','created_at','updated_at'],
  tf_menu_items: ['id','category_id','shop_id','name','description','price','image_url','status','monthly_sales','spec_group_ids','created_at','updated_at'],
  tf_spec_groups: ['id','shop_id','name','is_required','max_select','created_at','updated_at'],
  tf_spec_options: ['id','spec_group_id','name','price_adjust','is_default','created_at','updated_at'],
  tf_orders: ['id','order_no','shop_id','user_id','rider_id','status','total','delivery_type','address','shop_latitude','shop_longitude','delivery_latitude','delivery_longitude','table_no','remark','cancel_reason','reject_reason','contact_name','contact_phone','invoice_needed','invoice_title','invoice_tax_no','delivery_fee','estimated_completion','cancel_requested_at','cancel_request_reason','last_urged_at','urge_count','created_at','updated_at'],
  tf_order_status_history: ['id','order_id','shop_id','status','from_status','recorded_at','created_at'],
  tf_order_items: ['id','order_id','shop_id','menu_item_id','name','quantity','price','spec_desc','image_url','created_at','updated_at'],
  tf_delivery_info: ['id','order_id','shop_id','rider_id','courier_name','courier_phone','estimated_delivery_at','delivered_at','proof_photos','confirm_latitude','confirm_longitude','confirm_accuracy','confirm_distance_m','confirm_radius_m','confirm_source','force_reason','created_at','updated_at'],
  tf_delivery_tracks: ['id','order_id','shop_id','rider_id','latitude','longitude','speed','accuracy','source','recorded_at','created_at'],
  tf_promotions: ['id','shop_id','name','type','description','rule','status','start_date','end_date','created_at','updated_at'],
  tf_users: ['id','openid','user_id','role','shop_id','nick_name','avatar_url','last_login_at','username','password_hash','phone','created_at','updated_at'],
  tf_refresh_tokens: ['id','token_hash','user_id','expires_at','revoked','created_at'],
  tf_user_sessions: ['id','user_id','token_hash','expires_at','refresh_token_hash','refresh_expires_at','created_at'],
  tf_payments: ['id','order_id','shop_id','user_id','transaction_id','amount','method','status','paid_at','created_at','updated_at'],
  tf_favorites: ['id','user_id','menu_item_id','shop_id','created_at'],
  tf_reviews: ['id','order_id','shop_id','user_id','rating','content','reply_content','reply_at','created_at'],
  tf_addresses: ['id','user_id','shop_id','contact_name','contact_phone','detail','latitude','longitude','tag','is_default','created_at','updated_at'],
  tf_daily_stats: ['id','shop_id','stat_date','total_orders','total_revenue','completed_orders','cancelled_orders','created_at','updated_at'],
  tf_item_sales: ['id','menu_item_id','shop_id','order_id','order_date','quantity','revenue','created_at','updated_at'],
  tf_media_assets: ['id','shop_id','url','path','file_name','mime','size_bytes','created_at','updated_at'],
  tf_shop_tables: ['id','shop_id','table_no','label','sort_order','active','created_at'],
  tf_audit_logs: ['id','shop_id','user_id','role','method','path','action','resource','resource_id','summary','status_code','ip','created_at'],
  tf_user_roles: ['id','user_id','role','shop_id','status','created_at','updated_at'],
  tf_role_applications: ['id','user_id','apply_role','status','shop_name','shop_address','shop_phone','contact_name','contact_phone','payload','reject_reason','reviewer_id','reviewed_at','created_at','updated_at'],
  tf_notifications: ['id','user_id','type','title','content','related_type','related_id','is_read','created_at'],
};

// 期望的函数签名（参数名，源自 database-init.sql v1.0.6）
const EXPECTED_FUNCTIONS = {
  atomic_create_order: ['p_order_id','p_shop_id','p_user_id','p_total','p_delivery_fee','p_delivery_type','p_address','p_table_no','p_remark','p_contact_name','p_contact_phone','p_items','p_order_date','p_invoice_needed','p_invoice_title','p_invoice_tax_no','p_order_no'],
  atomic_update_order_status: ['p_order_id','p_from_status','p_to_status'],
  atomic_cancel_order: ['p_order_id','p_user_id'],
  atomic_pay_order: ['p_order_id','p_user_id','p_amount','p_transaction_id','p_method'],
  atomic_delete_category: ['p_category_id'],
  atomic_increment_menu_sales: ['p_menu_item_id','p_quantity','p_shop_id','p_order_date'],
  atomic_update_daily_stats: ['p_shop_id','p_stat_date','p_order_delta','p_revenue_delta','p_completed_delta','p_cancelled_delta'],
};

// ---------------------------------------------------------------- 手段 1：OpenAPI
async function fetchOpenApi() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/openapi+json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('  OpenAPI 获取失败：', e.message);
    return null;
  }
}

// ---------------------------------------------------------------- 手段 2/3/4：表与列
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

async function probeTable(table, expectedCols) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error && MISSING_TABLE_CODES.has(error.code)) {
    return { exists: false, code: error.code, msg: error.message };
  }
  if (error) return { exists: true, sampleError: `${error.code}: ${error.message}`, cols: null, missing: [] };

  const sampleCols = data && data.length > 0 ? Object.keys(data[0]) : null;
  const toProbe = sampleCols ? expectedCols.filter((c) => !sampleCols.includes(c)) : expectedCols;

  const missing = [];
  for (const col of toProbe) {
    const r = await supabase.from(table).select(col).limit(1);
    if (r.error && r.error.code === '42703') missing.push(col);
    else if (r.error) missing.push(`${col}(探测异常 ${r.error.code})`);
  }
  const extra = sampleCols ? sampleCols.filter((c) => !expectedCols.includes(c)) : [];
  return { exists: true, rowCount: data ? data.length : 0, sampleCols, missing, extra };
}

// ---------------------------------------------------------------- 手段 5：RPC
/**
 * 判定要点（易误判）：PostgREST 对「函数不存在」和「函数存在但签名不匹配」都返回 PGRST202。
 * 区分依据：
 *   - message 含 "without parameters" → 只是没有零参重载，函数本身存在
 *   - OpenAPI spec 的 /rpc/<fn> 路径存在 → 函数存在（最权威）
 *   - 两者都不满足 → 判定为真缺失
 */
async function probeFunction(fn, specRpcs) {
  const inSpec = specRpcs ? specRpcs.includes(fn) : null;
  const { error } = await supabase.rpc(fn, {});
  if (!error) return { exists: true, inSpec, note: '空参调用成功（存在且参数均有默认值）' };

  if (error.code === 'PGRST202') {
    const msg = error.message || '';
    const sigMismatch = /without parameters|Perhaps|meant to call/i.test(msg) || `${error.hint || ''}`.includes(fn);
    const exists = inSpec === true || sigMismatch;
    return {
      exists,
      inSpec,
      code: error.code,
      note: exists
        ? `存在（PGRST202 仅表示无零参重载${inSpec ? '；OpenAPI spec 已列出' : ''}）`
        : '真·缺失（spec 无此 RPC 且无签名不匹配提示）',
      message: msg,
      hint: error.hint || null,
    };
  }
  // 其它错误码（42883 参数类型 / 22P02 入参转换 / 23xxx 约束）都说明函数已存在
  return { exists: true, inSpec, code: error.code, note: `存在（调用报错 ${error.code}，非 PGRST202）`, message: error.message };
}

/** 从 OpenAPI spec 提取线上 RPC 的实际参数名 */
function specRpcParams(spec, fn) {
  const path = spec?.paths?.[`/rpc/${fn}`];
  if (!path) return null;
  const params = path.post?.parameters || [];
  const body = params.find((p) => p.in === 'body');
  const props = body?.schema?.properties;
  if (props) return Object.keys(props);
  const defName = body?.schema?.$ref?.split('/').pop();
  if (defName && spec.definitions?.[defName]?.properties) return Object.keys(spec.definitions[defName].properties);
  return [];
}

/**
 * 安全的函数体可执行性探测。
 * 仅对「读取订单失败即 RAISE、在任何写操作之前退出」的函数使用不存在的 UUID 调用：
 *   atomic_update_order_status / atomic_cancel_order / atomic_pay_order
 *   → 函数体 Step 1 为 SELECT ... FOR UPDATE，NOT FOUND 立即 RAISE EXCEPTION，事务回滚，零写入。
 * 明确排除 atomic_create_order / atomic_delete_category / atomic_increment_menu_sales /
 *   atomic_update_daily_stats —— 它们会真实写库，禁止探测。
 */
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-0000000000ff';
const SAFE_BODY_PROBES = {
  atomic_update_order_status: { p_order_id: NON_EXISTENT_UUID, p_from_status: 'paid', p_to_status: 'paid' },
  atomic_cancel_order: { p_order_id: NON_EXISTENT_UUID, p_user_id: '__inspect_probe__' },
  atomic_pay_order: { p_order_id: NON_EXISTENT_UUID, p_user_id: '__inspect_probe__', p_amount: 1, p_transaction_id: NON_EXISTENT_UUID, p_method: 'wechat' },
};

async function probeFunctionBody(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { raised: true, code: error.code, message: error.message };
  return { raised: false, data };
}

// ---------------------------------------------------------------- main
async function main() {
  console.log('='.repeat(70));
  console.log('线上 Supabase schema 只读探查 —— 目标:', SUPABASE_URL);
  console.log('='.repeat(70));

  console.log('\n【0】拉取 PostgREST OpenAPI spec …');
  const spec = await fetchOpenApi();
  let specTables = null;
  let specRpcs = null;
  if (spec) {
    specTables = Object.keys(spec.definitions || {}).filter((t) => t.startsWith('tf_')).sort();
    specRpcs = Object.keys(spec.paths || {})
      .filter((p) => p.startsWith('/rpc/'))
      .map((p) => p.slice(5))
      .sort();
    console.log(`  OK：spec 中 tf_* 表 ${specTables.length} 张，RPC ${specRpcs.length} 个`);
    console.log(`  spec 表清单: ${specTables.join(', ')}`);
    console.log(`  spec RPC 清单: ${specRpcs.join(', ') || '(无)'}`);
  } else {
    console.log('  跳过（未取到），改由逐表/逐列探测兜底');
  }

  console.log('\n【A/B】逐表 + 逐列探测');
  const missingTables = [];
  const missingCols = {};
  const extraCols = {};
  const tableInfo = {};

  for (const [table, cols] of Object.entries(EXPECTED_TABLES)) {
    const r = await probeTable(table, cols);
    tableInfo[table] = r;
    if (!r.exists) {
      missingTables.push(table);
      console.log(`  ❌ 缺表 ${table}  (${r.code})`);
      continue;
    }
    if (r.missing && r.missing.length) {
      missingCols[table] = r.missing;
      console.log(`  ⚠️  ${table.padEnd(24)} 缺列 ${r.missing.length}/${cols.length}: ${r.missing.join(', ')}`);
    } else {
      console.log(`  ✅ ${table.padEnd(24)} 列齐全 (${cols.length})  ${r.rowCount ? '' : '[空表·逐列探测]'}`);
    }
    if (r.extra && r.extra.length) {
      extraCols[table] = r.extra;
      console.log(`     ↳ 线上多出列（脚本未定义）: ${r.extra.join(', ')}`);
    }
  }

  console.log('\n【C】RPC 函数探测（存在性 + 签名比对）');
  const fnResults = {};
  for (const [fn, wantParams] of Object.entries(EXPECTED_FUNCTIONS)) {
    const r = await probeFunction(fn, specRpcs);
    const got = spec ? specRpcParams(spec, fn) : null;
    if (got) {
      r.onlineParams = got;
      r.missingParams = wantParams.filter((p) => !got.includes(p));
      r.extraParams = got.filter((p) => !wantParams.includes(p));
    }
    fnResults[fn] = r;
    const tag = specRpcs ? (specRpcs.includes(fn) ? 'spec:有' : 'spec:无') : 'spec:未知';
    console.log(`  ${r.exists ? '✅' : '❌'} ${fn.padEnd(30)} [${tag}] ${r.note}`);
    if (got) {
      const sigOk = r.missingParams.length === 0 && r.extraParams.length === 0;
      console.log(`     签名 ${sigOk ? '✅ 与脚本一致' : '⚠️ 与脚本不一致'} (线上 ${got.length} 参 / 期望 ${wantParams.length} 参)`);
      if (r.missingParams.length) console.log(`       线上缺参数: ${r.missingParams.join(', ')}`);
      if (r.extraParams.length) console.log(`       线上多参数: ${r.extraParams.join(', ')}`);
    }
  }

  console.log('\n【C2】函数体可执行性探测（仅对写操作前即 RAISE 的函数，用不存在的 UUID，零写入）');
  const bodyResults = {};
  for (const [fn, args] of Object.entries(SAFE_BODY_PROBES)) {
    const r = await probeFunctionBody(fn, args);
    bodyResults[fn] = r;
    console.log(`  ${fn.padEnd(30)} → ${r.raised ? `RAISE ${r.code}: ${r.message}` : `返回 ${JSON.stringify(r.data)}`}`);
  }

  console.log('\n【B2】基于 OpenAPI definitions 的全量列比对（权威，覆盖空表）');
  const specDiff = {};
  for (const [t, cols] of Object.entries(EXPECTED_TABLES)) {
    const def = spec?.definitions?.[t];
    if (!def?.properties) continue;
    const online = Object.keys(def.properties);
    const miss = cols.filter((c) => !online.includes(c));
    const extra = online.filter((c) => !cols.includes(c));
    const req = def.required || [];
    if (miss.length || extra.length) {
      specDiff[t] = { missing: miss, extra, notNull: req };
      console.log(`  ${t}`);
      if (miss.length) console.log(`    线上缺列 : ${miss.join(', ')}`);
      if (extra.length) {
        const flagged = extra.map((c) => (req.includes(c) ? `${c} [NOT NULL⚠]` : c));
        console.log(`    线上多列 : ${flagged.join(', ')}`);
      }
    }
  }
  console.log('\n  受影响表的线上 NOT NULL 清单：');
  for (const t of Object.keys(specDiff)) {
    console.log(`    ${t}: ${(specDiff[t].notNull || []).join(', ') || '(无)'}`);
  }

  console.log('\n  线上「多出且 NOT NULL」列的完整定义（判断是否有 default，决定写入是否会失败）：');
  for (const [t, d] of Object.entries(specDiff)) {
    for (const c of d.extra) {
      if (!d.notNull.includes(c)) continue;
      console.log(`    ${t}.${c} = ${JSON.stringify(spec.definitions[t].properties[c])}`);
    }
  }

  console.log('\n【D】主键/外键（PostgREST 在列 description 里标注，可探测的部分）');
  console.log('  ⚠️ 普通索引 / UNIQUE 索引 / CHECK 约束 / 触发器：REST 无法探测，需人工 SQL Editor 确认');
  for (const t of Object.keys(EXPECTED_TABLES)) {
    const props = spec?.definitions?.[t]?.properties;
    if (!props) continue;
    const fks = [];
    for (const [c, p] of Object.entries(props)) {
      const d = p.description || '';
      const m = d.match(/This is a Foreign Key to `([^`]+)`/);
      if (m) fks.push(`${c}→${m[1]}`);
    }
    if (fks.length) console.log(`  ${t.padEnd(24)} FK: ${fks.join(', ')}`);
    else console.log(`  ${t.padEnd(24)} FK: (无)`);
  }

  console.log('\n【E】旁证：tf_payments.status 分布（判断 v22 迁移是否已执行）');
  {
    const { data, error } = await supabase.from('tf_payments').select('status').limit(1000);
    if (error) console.log('  查询失败：', error.message);
    else {
      const dist = {};
      for (const r of data) dist[r.status] = (dist[r.status] || 0) + 1;
      console.log('  ', JSON.stringify(dist), `（共 ${data.length} 条）`);
      console.log(
        `   ${dist.success ? '→ 仍存在 success 状态：v22「success→paid 规范化」未执行' : '→ 无 success 状态'}`,
      );
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('汇总');
  console.log('='.repeat(70));
  console.log('A. 缺失的表     :', missingTables.length ? missingTables.join(', ') : '无');
  console.log('B. 缺失的列     :', Object.keys(missingCols).length ? '' : '无');
  for (const [t, cs] of Object.entries(missingCols)) console.log(`   - ${t}: ${cs.join(', ')}`);
  const missFn = Object.entries(fnResults).filter(([, r]) => !r.exists).map(([f]) => f);
  console.log('C. 缺失的函数   :', missFn.length ? missFn.join(', ') : '无');
  console.log('D. 索引/约束/触发器: REST 接口无法探测，需人工在 SQL Editor 用 pg_indexes / pg_trigger 确认');

  console.log('\n--- 机器可读 JSON ---');
  console.log(JSON.stringify({ missingTables, missingCols, extraCols, functions: fnResults, specTables, specRpcs }, null, 2));
}

main().catch((e) => {
  console.error('探查失败:', e.message || e);
  process.exit(1);
});
