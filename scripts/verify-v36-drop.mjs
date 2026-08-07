// 验证 v36 迁移结果：tf_customer_tags / tf_customer_tag_relations 应不存在，
// tf_messages（站内信）应保留。复用 Management API 查询 information_schema。
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

const sql = `SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tf_customer_tags', 'tf_customer_tag_relations', 'tf_messages')
ORDER BY table_name;`;

const bodyPath = '/tmp/v36-verify-body.json';
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
  console.log('查询响应：', out);
  const json = JSON.parse(out);
  const rows = Array.isArray(json) ? json : (json?.data ?? []);
  const names = rows.map((r) => (r.table_name ?? r.TABLE_NAME ?? Object.values(r)[0])).filter(Boolean);
  console.log('存在的表：', names);
  const tagGone = !names.some((n) => n === 'tf_customer_tags' || n === 'tf_customer_tag_relations');
  const msgKept = names.includes('tf_messages');
  console.log('标签表已移除：', tagGone ? '✅' : '❌');
  console.log('站内信表 tf_messages 保留：', msgKept ? '✅' : '❌');
  process.exit(tagGone && msgKept ? 0 : 1);
} catch (e) {
  console.error('❌ 验证失败：', e.message);
  if (e.stdout) console.error('stdout:', e.stdout);
  if (e.stderr) console.error('stderr:', e.stderr);
  process.exit(1);
}
