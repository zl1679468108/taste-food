import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'merchant', password: 'merchant123' },
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

await page.goto(`${BASE}/merchant/dashboard`);
await sleep(50000);
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/dashboard-merchant.png', fullPage: true });
const t1 = await page.evaluate(() => document.body.innerText);
console.log('[shot] merchant dashboard | 待接单:', t1.includes('待接单'), '待备餐:', t1.includes('待备餐'), '11:', t1.includes('11'));

// 点击「待接单」→ 应跳 /merchant/order?status=paid
await page.getByText('待接单').first().click();
await page.waitForURL('**/merchant/order**status=paid', { timeout: 10000 });
await sleep(8000);
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/order-paid.png', fullPage: true });
console.log('[shot] order paid | url=', page.url());

// 回 dashboard 点「待备餐」→ 应跳 /merchant/order?status=accepted
await page.goto(`${BASE}/merchant/dashboard`);
await sleep(40000);
await page.getByText('待备餐').first().click();
await page.waitForURL('**/merchant/order**status=accepted', { timeout: 10000 });
await sleep(8000);
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/order-accepted.png', fullPage: true });
console.log('[shot] order accepted | url=', page.url());

await browser.close();