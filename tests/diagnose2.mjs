import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const apiReqs = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CON: ' + m.text());
});
page.on('pageerror', (e) => errors.push('PERR: ' + e.message));
page.on('request', (r) => {
  if (r.url().includes('/api/')) apiReqs.push(r.method() + ' ' + r.url().replace(BASE, ''));
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
await sleep(15000);

console.log('URL:', page.url());
console.log('TITLE:', await page.title());
const text = await page.evaluate(() => document.body.innerText);
console.log('contains 登录:', text.includes('登录'));
console.log('contains 数据看板:', text.includes('数据看板'));
console.log('contains 账号:', text.includes('账号'));
console.log('contains 密码:', text.includes('密码'));
console.log('contains 待处理:', text.includes('待处理'));
console.log('root children count:', await page.evaluate(() => document.getElementById('root')?.children?.length ?? 'no #root'));
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/diag2.png', fullPage: true });
console.log('--- ERRORS ---');
console.log(errors.join('\n') || '(none)');
console.log('--- API REQUESTS ---');
console.log(apiReqs.join('\n') || '(none)');
await browser.close();