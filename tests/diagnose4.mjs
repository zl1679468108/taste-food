import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const allConsole = [];
const apiReqs = [];
page.on('console', (m) => allConsole.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => allConsole.push(`PAGEERROR: ${e.message}\n${e.stack || ''}`));
page.on('request', (r) => {
  const u = r.url().replace(BASE, '');
  if (u.startsWith('/api/') || u.includes('__umi')) apiReqs.push({ url: u, status: 'pending' });
});
page.on('response', (r) => {
  const u = r.url().replace(BASE, '');
  const i = apiReqs.findIndex((x) => x.url === u && x.status === 'pending');
  if (i >= 0) apiReqs[i].status = String(r.status());
});

const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'admin', password: 'admin123' },
});
const { data } = await loginResp.json();
await page.goto(`${BASE}/login`);
await page.evaluate(
  (d) => {
    localStorage.setItem('token', d.token);
    if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
    const { token: _t, refreshToken: _r, ...u } = d;
    localStorage.setItem('user', JSON.stringify(u));
  },
  data,
);

await page.goto(`${BASE}/dashboard`);
await sleep(25000);

console.log('URL:', page.url());
const text = await page.evaluate(() => document.body.innerText);
console.log('contains 数据看板:', text.includes('数据看板'));
console.log('contains 待处理:', text.includes('待处理'));
console.log('contains 待接单:', text.includes('待接单'));
console.log('contains 待备餐:', text.includes('待备餐'));
console.log('root innerHTML length:', await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0));
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/diag4.png', fullPage: true });

console.log('\n--- ALL CONSOLE (前 40 条) ---');
console.log(allConsole.slice(0, 40).join('\n\n'));
console.log('\n--- API/UMI REQS ---');
for (const r of apiReqs) console.log(`${r.status} ${r.url}`);
await browser.close();