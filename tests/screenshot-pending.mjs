import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const OUT = '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1. 登录拿 token 注入 localStorage（绕过 antd 表单竞态）
const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'admin', password: 'admin123' },
});
const loginJson = await loginResp.json();
const { token, refreshToken, ...user } = loginJson.data;
await page.goto(`${BASE}/login`);
await page.evaluate(
  (d) => {
    localStorage.setItem('token', d.token);
    if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
    const { token: _t, refreshToken: _r, ...u } = d;
    localStorage.setItem('user', JSON.stringify(u));
  },
  { token, refreshToken, ...user },
);

// 2. 进入 Dashboard
await page.goto(`${BASE}/dashboard`);
await page.waitForURL('**/dashboard', { timeout: 20000 });
await page.waitForSelector('text=待处理', { timeout: 20000 });
await sleep(3000); // 等待处理区轮询数据落地
await page.screenshot({ path: `${OUT}/pending-dashboard.png`, fullPage: true });
console.log('[shot] dashboard 完成');

// 3. 点击「待接单」→ 应跳 /merchant/order?status=paid
await page.getByText('待接单').first().click();
await page.waitForURL('**/merchant/order**status=paid', { timeout: 10000 });
await sleep(1500);
await page.screenshot({ path: `${OUT}/order-paid.png`, fullPage: true });
console.log('[shot] order-paid 完成, URL =', page.url());

// 4. 回 Dashboard 点「待备餐」→ 应跳 /merchant/order?status=accepted
await page.goto(`${BASE}/dashboard`);
await sleep(2500);
await page.getByText('待备餐').first().click();
await page.waitForURL('**/merchant/order**status=accepted', { timeout: 10000 });
await sleep(1500);
await page.screenshot({ path: `${OUT}/order-accepted.png`, fullPage: true });
console.log('[shot] order-accepted 完成, URL =', page.url());

await browser.close();
console.log('[done]');
