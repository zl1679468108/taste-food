// 核查生产库 tf_orders 上 v34 的 5 个复合索引是否已创建
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REF = 'fvggqgeiwewsjojargxe';
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const PAT_FILE = `${HOME}/.workbuddy/supabase_pat.txt`;
const PAT =
  process.env.SUPABASE_PAT ||
  (() => {
    try {
      return readFileSync(PAT_FILE, 'utf8').trim();
    } catch {
      return '';
    }
  })();
if (!PAT) {
  console.error('❌ 缺少 SUPABASE_PAT');
  process.exit(1);
}

const EXPECTED = [
  'idx_orders_shop_status',
  'idx_orders_status_shop',
  'idx_orders_user_status',
  'idx_orders_rider_status',
  'idx_orders_delivery_pool',
];
const sql = `SELECT indexname FROM pg_indexes
WHERE tablename = 'tf_orders' AND indexname IN (
  'idx_orders_shop_status',
  'idx_orders_status_shop',
  'idx_orders_user_status',
  'idx_orders_rider_status',
  'idx_orders_delivery_pool'
)`;
const bodyPath = '/tmp/verify-v34-body.json';
writeFileSync(bodyPath, JSON.stringify({ query: sql }));
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const args = [
  '-s', '-X', 'POST',
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  '-H', `Authorization: Bearer ${PAT}`,
  '-H', 'Content-Type: application/json',
  '--data', `@${bodyPath}`,
];
if (proxy) args.unshift('-x', proxy);
try {
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const rows = JSON.parse(out || '[]');
  const found = rows.map((r) => r.indexname).sort();
  console.log('生产库现有 v34 索引：', found.length ? found.join(', ') : '（无）');
  const missing = EXPECTED.filter((n) => !found.includes(n));
  if (missing.length === 0) {
    console.log('✅ 5 个索引全部就位。');
  } else {
    console.log('⚠️ 缺失：', missing.join(', '));
    process.exit(2);
  }
} catch (e) {
  console.error('❌ 查询失败：', e.message);
  if (e.stdout) console.error('stdout:', e.stdout);
  if (e.stderr) console.error('stderr:', e.stderr);
  process.exit(1);
}
