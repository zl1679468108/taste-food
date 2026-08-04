import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = []; // {url, status, startTs, endTs}
page.on('request', (r) => {
  const u = r.url().replace(BASE, '');
  if (u.startsWith('/api/')) reqs.push({ url: u, status: 'pending', startTs: Date.now() });
});
page.on('response', async (r) => {
  const u = r.url().replace(BASE, '');
  const i = reqs.findIndex((x) => x.url === u && x.status === 'pending');
  if (i >= 0) {
    reqs[i].status = String(r.status());
    reqs[i].endTs = Date.now();
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

await page.goto(`${BASE}/platform/dashboard`);
await sleep(50000);

const text = await page.evaluate(() => document.body.innerText);
console.log('contains 待处理:', text.includes('待处理'));
console.log('contains 待接单:', text.includes('待接单'));
console.log('contains 11:', text.includes('11'));
console.log('contains "1":', text.includes('1'));
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/dashboard-platform2.png', fullPage: true });

console.log('\n--- /api/* REQUESTS ---');
for (const r of reqs) {
  const dur = r.endTs ? `${((r.endTs - r.startTs) / 1000).toFixed(1)}s` : r.status;
  console.log(`${r.status.padEnd(6)} ${dur.padEnd(8)} ${r.url}`);
}
await browser.close();