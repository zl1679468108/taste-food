// 核查生产库 get_today_stats / get_daily_stats 是否已改为 Asia/Shanghai（无残留 UTC）
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REF = 'fvggqgeiwewsjojargxe';
const HOME = process.env.HOME || '';
const PAT =
  process.env.SUPABASE_PAT ||
  (() => {
    try {
      return readFileSync(`${HOME}/.workbuddy/supabase_pat.txt`, 'utf8').trim();
    } catch {
      return '';
    }
  })();
if (!PAT) {
  console.error('❌ 缺少 SUPABASE_PAT');
  process.exit(1);
}

const sql = `SELECT proname,
  (prosrc LIKE '%Asia/Shanghai%') AS uses_beijing,
  (prosrc LIKE '%AT TIME ZONE %UTC%') AS uses_utc
FROM pg_proc
WHERE proname IN ('get_today_stats','get_daily_stats')
ORDER BY proname`;

const bodyPath = '/tmp/verify-tz-body.json';
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
  console.log('RPC 时区口径核查：');
  for (const r of rows) {
    console.log(`  ${r.proname}: uses_beijing=${r.uses_beijing}  uses_utc=${r.uses_utc}`);
  }
  const ok = rows.length === 2 && rows.every((r) => r.uses_beijing && !r.uses_utc);
  console.log(ok ? '✅ 两个 RPC 均已改为 Asia/Shanghai，无残留 UTC。' : '⚠️ 存在残留 UTC 或未更新，请检查。');
} catch (e) {
  console.error('❌ 查询失败：', e.message);
  if (e.stdout) console.error(e.stdout);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
}
