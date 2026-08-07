import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 仅捕获 /api/orders 请求的响应体节选，方便核对 data.counts 与界面角标是否对齐
const ordersResponses = [];
page.on('response', async (resp) => {
  if (resp.url().includes('/api/orders?') && resp.url().includes('pageSize=')) {
    try {
      const body = await resp.json();
      ordersResponses.push({ url: resp.url(), counts: body?.data?.counts });
    } catch {}
  }
});

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

// 进 /merchant/order（不带 status），等 react-query 拿到 counts
await page.goto(`${BASE}/merchant/order`);
await sleep(8000);
await page.screenshot({
  path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/order-tabs-all-badges.png',
  fullPage: true,
});
console.log('[shot] /merchant/order url=', page.url());

// 切到 「已接单」tab（count=10）
await page.getByRole('tab', { name: /已接单/ }).click();
await sleep(5000);
await page.screenshot({
  path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/order-tabs-accepted.png',
  fullPage: true,
});
console.log('[shot] accepted url=', page.url());

// 切回 「全部」再捕一次
await page.getByRole('tab', { name: /全部/ }).click();
await sleep(5000);

// 抽 Tabs 区域的文本，验证角标存在
const tabBarText = await page.evaluate(() => {
  const tabs = document.querySelector('.ant-tabs-nav');
  return tabs ? tabs.innerText : '';
});
console.log('[tabs]', tabBarText);

console.log('[orders api counts]', JSON.stringify(ordersResponses[ordersResponses.length - 1], null, 2));

await browser.close();
