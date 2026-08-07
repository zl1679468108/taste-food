// 将 v36 迁移（移除顾客标签子系统）apply 到生产 Supabase 库。
// 复用 M-001 / v35 的 Management API 流程：PAT 从 ~/.workbuddy/supabase_pat.txt 读取。
// 用法（在仓库根目录运行）：
//   node scripts/apply-v36-drop-customer-tags.mjs
//
// 说明：
// - 仅执行 docs/migrations/v36-drop-customer-tags.sql（DROP 两张标签表，幂等可重跑）
// - 本机出网走 HTTP 代理，端口动态，从环境变量 HTTPS_PROXY 读取（不写死）
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  console.error('❌ 缺少 SUPABASE_PAT：请 export 环境变量，或在 ~/.workbuddy/supabase_pat.txt 放置 token');
  process.exit(1);
}

const sqlPath = new URL('../docs/migrations/v36-drop-customer-tags.sql', import.meta.url);
const sql = readFileSync(sqlPath, 'utf8');
const bodyPath = '/tmp/v36-drop-body.json';
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
  console.log('✅ apply 响应：', out || '(空响应，通常代表成功)');
  console.log('\n下一步：运行 scripts/verify-v36-drop.mjs 确认两张标签表已不存在。');
} catch (e) {
  console.error('❌ curl 调用失败：', e.message);
  if (e.stdout) console.error('stdout:', e.stdout);
  if (e.stderr) console.error('stderr:', e.stderr);
  process.exit(1);
}
