import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const reqs = []; // {method, url, status, time}
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CON: ' + m.text());
});
page.on('pageerror', (e) => errors.push('PERR: ' + e.message));
page.on('request', (r) => {
  if (r.url().includes('/api/')) {
    reqs.push({ method: r.method(), url: r.url().replace(BASE, ''), status: 'pending', time: Date.now() });
  }
});
page.on('response', async (resp) => {
  if (resp.url().includes('/api/')) {
    const u = resp.url().replace(BASE, '');
    const i = reqs.findIndex((x) => x.url === u && x.status === 'pending');
    if (i >= 0) reqs[i].status = String(resp.status());
  }
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
// 等到「待处理」出现或 50s 超时
try {
  await page.waitForSelector('text=待处理', { timeout: 50000 });
  console.log('[ok] 待处理 出现');
} catch (e) {
  console.log('[timeout] 50s 内未出现待处理');
}
await sleep(3000);

console.log('URL:', page.url());
const text = await page.evaluate(() => document.body.innerText);
console.log('contains 待处理:', text.includes('待处理'));
console.log('contains 数据看板:', text.includes('数据看板'));
console.log('contains 待接单:', text.includes('待接单'));
console.log('contains 待备餐:', text.includes('待备餐'));
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/diag3.png', fullPage: true });

console.log('--- API REQUESTS (按时间) ---');
for (const r of reqs) console.log(`${r.status} ${r.method} ${r.url}`);
console.log('--- ERRORS ---');
console.log(errors.join('\n') || '(none)');
await browser.close();