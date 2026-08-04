import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const OUT = '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

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
await page.waitForLoadState('networkidle');
await sleep(6000); // 给前端轮询留足时间

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('contains 待处理:', bodyText.includes('待处理'));
console.log('contains 数据看板:', bodyText.includes('数据看板'));
console.log('contains 订单:', bodyText.includes('订单'));
console.log('contains 营收:', bodyText.includes('营收'));
console.log('contains 待接单:', bodyText.includes('待接单'));
console.log('contains 待备餐:', bodyText.includes('待备餐'));

// 当前 URL 上的 pending 请求是否仍挂起：检查网络
await page.screenshot({ path: `${OUT}/diagnose-dashboard.png`, fullPage: true });
console.log('--- ERRORS ---');
console.log(errors.join('\n') || '(none)');
await browser.close();
